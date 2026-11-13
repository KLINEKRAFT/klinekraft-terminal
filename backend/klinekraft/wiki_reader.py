"""Bounded Kiwix reading view. Only the fixed loopback reader is contacted."""
import http.client
import re
from urllib.parse import urljoin, urlsplit, quote, unquote, urlencode
from bs4 import BeautifulSoup
from defusedxml import ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from .local_content import local_request

router = APIRouter(prefix='/api/wiki', dependencies=[Depends(local_request)])
BASE = 'http://127.0.0.1:8081'


def content_path(value, base=BASE + '/'):
    if not isinstance(value, str) or len(value) > 2048: raise HTTPException(400, 'Invalid article path.')
    url = urlsplit(urljoin(base, value))
    if url.scheme != 'http' or url.netloc != '127.0.0.1:8081': raise HTTPException(400, 'Only local archive content is supported.')
    decoded = unquote(url.path)
    if not decoded.startswith('/content/') or any(p in ('.', '..') for p in decoded.split('/')) or any(ord(c) < 32 for c in decoded) or '\\' in decoded or '%' in decoded:
        raise HTTPException(400, 'Invalid archive path.')
    return quote(decoded, safe='/:@!$&\'()*+,;=-._~')


def fetch_local(path, limit=3_000_000):
    for _ in range(4):
        connection = http.client.HTTPConnection('127.0.0.1', 8081, timeout=6)
        try:
            connection.request('GET', path, headers={'Accept-Encoding': 'identity'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                path = content_path(response.getheader('Location', ''), BASE + path)
                continue
            if response.status != 200: raise HTTPException(503, 'The local reader could not find this content.')
            body = response.read(limit + 1)
            if len(body) > limit: raise HTTPException(413, 'This article or image is too large for reading view. Open the original reader.')
            return body, response.getheader('Content-Type', '').split(';')[0], path
        except (OSError, http.client.HTTPException):
            raise HTTPException(503, 'Wikipedia reader is unavailable. Check klinekraft-wiki.service.')
        finally:
            connection.close()
    raise HTTPException(503, 'The reader returned too many redirects.')


def books():
    raw, _, _ = fetch_local('/catalog/v2/entries?count=100')
    try: root = ET.fromstring(raw)
    except Exception: raise HTTPException(503, 'The reader catalog could not be read.')
    result = []
    for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
        title = entry.findtext('{http://www.w3.org/2005/Atom}title') or 'Wikipedia'
        for link in entry.findall('{http://www.w3.org/2005/Atom}link'):
            if link.get('type') != 'text/html': continue
            try: path = content_path(link.get('href', ''))
            except HTTPException: continue
            name = unquote(path).split('/')[2]
            if 'wikipedia' not in (name + title).lower(): continue
            result.append({'name': name, 'title': title, 'path': path})
            break
    return result


def search(query, book=None, limit=12):
    available = books()
    selected = next((b for b in available if b['name'] == book), None) if book else next(iter(available), None)
    if not selected: return []
    raw, _, _ = fetch_local('/search?' + urlencode({'books.name': selected['name'], 'pattern': query, 'format': 'xml', 'pageLength': min(limit, 12)}))
    try: root = ET.fromstring(raw)
    except Exception: raise HTTPException(503, 'Search is unavailable for this archive.')
    results = []
    for item in root.findall('.//item')[:limit]:
        try: path = content_path(item.findtext('link') or '')
        except HTTPException: continue
        description = item.find('description')
        text = ''.join(description.itertext()) if description is not None else ''
        results.append({'title': item.findtext('title') or 'Article', 'path': path,
                        'snippet': BeautifulSoup(text, 'html.parser').get_text(' ', strip=True)[:500]})
    return results


def article(path):
    raw, mime, path = fetch_local(content_path(path))
    if mime not in ('text/html', 'application/xhtml+xml'): raise HTTPException(400, 'Choose an article.')
    soup = BeautifulSoup(raw, 'html.parser')
    title = (soup.find('h1') or soup.find('title'))
    title = title.get_text(' ', strip=True) if title else unquote(path.rsplit('/', 1)[-1]).replace('_', ' ')
    canonical = soup.find('link', rel='canonical')
    original = None
    if canonical:
        candidate = canonical.get('href', '')
        parsed = urlsplit(candidate)
        if parsed.scheme == 'https' and (parsed.hostname or '').endswith('.wikipedia.org'): original = candidate
    content = soup.select_one('#mw-content-text') or soup.select_one('main') or soup.body or soup
    for node in content.select('script, style, iframe, object, embed, form, nav, header, footer, .navbox, .mw-editsection, .noprint'):
        node.decompose()
    images, seen = [], set()
    for img in content.find_all('img'):
        try: src = content_path(img.get('src', ''), BASE + path)
        except HTTPException: continue
        if src in seen or not img.get('src'): continue
        try:
            if int(img.get('width', 100)) < 80 or int(img.get('height', 100)) < 60: continue
        except (ValueError, TypeError): pass
        seen.add(src)
        figure = img.find_parent(['figure']) or img.find_parent(class_='thumb')
        caption_node = figure.select_one('figcaption, .thumbcaption') if figure else None
        caption = caption_node.get_text(' ', strip=True) if caption_node else img.get('alt', '')
        images.append({'path': src, 'caption': str(caption)[:600]})
        if len(images) >= 6: break
    blocks, total = [], 0
    for node in content.find_all(['h2', 'h3', 'p', 'li', 'tr']):
        if node.find_parent(['li', 'tr']): continue
        text = node.get_text(' ', strip=True)
        if len(text) < 2: continue
        text = text[:6000]
        blocks.append({'kind': node.name, 'text': text})
        total += len(text)
        if len(blocks) >= 350 or total >= 180000: break
    links, seen_links = [], set()
    for anchor in content.find_all('a', href=True):
        if anchor['href'].startswith('#'): continue
        try: target = content_path(anchor['href'], BASE + path)
        except HTTPException: continue
        label = anchor.get_text(' ', strip=True)
        if not label or target in seen_links or target == path: continue
        seen_links.add(target); links.append({'path': target, 'title': label[:150]})
        if len(links) >= 30: break
    return {'title': title[:250], 'path': path, 'original': original, 'blocks': blocks, 'images': images,
            'links': links, 'truncated': total >= 180000 or len(blocks) >= 350}


@router.get('/books')
def list_books(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return {'books': books()}


@router.get('/search')
def search_route(q: str = Query(min_length=1, max_length=200), book: str | None = None):
    return {'results': search(q, book)}


@router.get('/article')
def article_route(path: str):
    return article(path)


@router.get('/image')
def image_route(path: str):
    body, mime, _ = fetch_local(content_path(path), limit=5_000_000)
    if mime not in ('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'):
        raise HTTPException(415, 'Image format is not supported by reading view.')
    return Response(body, media_type=mime, headers={'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff'})

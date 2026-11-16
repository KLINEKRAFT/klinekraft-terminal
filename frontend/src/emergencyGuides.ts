// Reviewed against the linked primary sources on 2026-11-16. Bundled for offline use.
export const emergencyGuides: Record<string, { title: string; steps: string[]; source: string; url: string }> = {
  'power outage': {
    title: 'Power outage — first actions',
    steps: [
      'Use generators outdoors, at least 20 feet from doors, windows and vents. Never run one in a garage, even with the door open. Use a battery-powered carbon monoxide detector.',
      'Keep grills and camping stoves outside. Never heat your home with a gas oven.',
      'If indoor temperatures become unsafe, move to a safe heated or cooled shelter. Check on people who need help.'
    ],
    source: 'CDC · Power outage safety',
    url: 'https://www.cdc.gov/natural-disasters/response/what-to-do-protect-yourself-during-a-power-outage.html'
  },
  'water sanitation': {
    title: 'Drinking water — first actions',
    steps: [
      'Follow local water advisories. Use safe bottled water when available.',
      'For germ contamination: strain cloudy water through a clean cloth or let it settle, then use the clear water. Bring it to a rolling boil for 1 minute; above 6,500 feet, boil for 3 minutes. Cool and store in a clean, sanitized, covered container.',
      'Boiling or disinfecting cannot make water containing fuel, toxic chemicals or radioactive material safe. Use another safe source.'
    ],
    source: 'CDC · Make water safe',
    url: 'https://www.cdc.gov/water-emergency/about/index.html'
  },
  'first aid': {
    title: 'Severe bleeding — first actions',
    steps: [
      'Check that the scene is safe. Use protective gloves if available. For continuous or spurting bleeding, call 911 or have someone call immediately.',
      'Apply firm, steady pressure directly over the wound using gauze or a clean cloth.',
      'For life-threatening bleeding from an arm or leg, use a tourniquet if available and you are trained. Follow emergency dispatcher instructions.'
    ],
    source: 'American Red Cross · Life-threatening bleeding',
    url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/bleeding-life-threatening-external'
  },
  'shelter weather': {
    title: 'Shelter or evacuate — first actions',
    steps: [
      'Listen to local emergency officials by radio or other available alerts. The safe shelter location depends on the hazard.',
      'If directed to evacuate, leave promptly using the routes officials specify. Bring your emergency supplies.',
      'If directed to shelter in place, act immediately and follow the instructions for that incident. Keep listening for updates and the all-clear.'
    ],
    source: 'Michigan · Evacuation and shelter-in-place',
    url: 'https://www.michigan.gov/miready/family-preparedness-guide/before-during-and-after-a-disaster/evacuation-and-shelter-in-place'
  }
};

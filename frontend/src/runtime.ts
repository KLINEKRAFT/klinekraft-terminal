// Hosted builds show fixtures; live telemetry requires the local Python service.
export const isHostedDemo = import.meta.env.MODE === "demo";

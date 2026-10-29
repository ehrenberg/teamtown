import { createApp } from './create-app.ts';
import { loadAppConfig } from './platform/config/app-config.ts';

const config = loadAppConfig(process.env);
if (!config.ok) {
  console.error(`Invalid configuration:\n  ${config.error.join('\n  ')}`);
  process.exit(1);
}

const app = await createApp(config.value);
await app.listen(config.value.PORT, config.value.HOST);

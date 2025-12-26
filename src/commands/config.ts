import { ConfigService } from '../services/configService';

export function configInitCommand() {
  console.log('Creating CommitGenie config file...\n');

  const result = ConfigService.initConfig();

  if (result.success) {
    console.log(`✓ ${result.message}`);
    if (result.path) {
      console.log(`  Location: ${result.path}`);
    }
    console.log('\nYou can customize:');
    console.log('  - scopes: Map file patterns to scope names');
    console.log('  - defaultType: Default commit type (feat, fix, etc.)');
    console.log('  - maxMessageLength: Maximum commit message length');
  } else {
    console.log(`✗ ${result.message}`);
    if (result.path) {
      console.log(`  Existing file: ${result.path}`);
    }
  }
}

export function configShowCommand() {
  const config = ConfigService.getConfig();
  console.log('Current CommitGenie configuration:\n');
  console.log(JSON.stringify(config, null, 2));
}

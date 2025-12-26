import { HookService } from '../services/hookService';
import { GitService } from '../services/gitService';

export function hookInstallCommand() {
  // Check if in a git repository
  if (!GitService.isGitRepository()) {
    console.error('Error: Not a git repository');
    console.log('Please run this command inside a git repository.');
    process.exit(1);
  }

  console.log('Installing CommitGenie git hook...\n');

  const result = HookService.install();

  if (result.success) {
    console.log(`✓ ${result.message}`);
    console.log('\nThe hook will automatically suggest commit messages when you run:');
    console.log('  git commit');
  } else {
    console.error(`✗ ${result.message}`);
    process.exit(1);
  }
}

export function hookUninstallCommand() {
  // Check if in a git repository
  if (!GitService.isGitRepository()) {
    console.error('Error: Not a git repository');
    console.log('Please run this command inside a git repository.');
    process.exit(1);
  }

  console.log('Uninstalling CommitGenie git hook...\n');

  const result = HookService.uninstall();

  if (result.success) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`✗ ${result.message}`);
    process.exit(1);
  }
}

export function hookStatusCommand() {
  // Check if in a git repository
  if (!GitService.isGitRepository()) {
    console.error('Error: Not a git repository');
    console.log('Please run this command inside a git repository.');
    process.exit(1);
  }

  const isInstalled = HookService.isInstalled();

  if (isInstalled) {
    console.log('✓ CommitGenie hook is installed');
    console.log(`  Location: ${HookService.getHookPath()}`);
  } else {
    console.log('✗ CommitGenie hook is not installed');
    console.log('\nTo install, run:');
    console.log('  commit-genie hook install');
  }
}

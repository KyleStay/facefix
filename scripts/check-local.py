"""Offline CI entry point. No GitHub, network, signing, provisioning or upload."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check_policy(root):
    workflows = root / '.github/workflows'
    forbidden = sorted(path.relative_to(root).as_posix()
                       for path in workflows.rglob('*')
                       if path.is_file() and path.suffix.lower() in {'.yml', '.yaml'})
    if forbidden:
        raise ValueError('Local-only CI: remove executable GitHub workflows: ' + ', '.join(forbidden))


def main():
    check_policy(ROOT)
    # Explicit lists avoid shell expansion, shell interpolation and remote tasks.
    commands = [[sys.executable, str(ROOT/'scripts/sync-safari.py'), '--check'],
                ['node', str(ROOT/'scripts/build-messenger-rules.mjs'), '--check'],
                ['node', '--test', *[str(path) for path in sorted((ROOT/'tests').glob('*.test.cjs'))]]]
    commands += [[sys.executable, str(path)] for path in sorted((ROOT/'tests').glob('*.test.py'))]
    commands += [['node', '--check', str(path)] for path in sorted(ROOT.glob('*.js'))]
    commands += [['git', 'diff', '--check']]
    for command in commands:
        subprocess.run(command, cwd=ROOT, check=True)
    print('Local CI passed. Browser/device execution and distribution remain separate gates.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

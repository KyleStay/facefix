import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('local_ci', Path(__file__).resolve().parents[1]/'scripts/check-local.py')
local_ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local_ci)


class LocalPolicy(unittest.TestCase):
    def test_workflow_yaml_is_refused_before_validation(self):
        for extension in ['yml', 'yaml']:
            with self.subTest(extension=extension), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                workflows = root/'.github/workflows'
                workflows.mkdir(parents=True)
                (workflows/f'ci.{extension}').write_text('on: push\njobs: {}\n')
                with self.assertRaisesRegex(ValueError, 'Local-only CI'):
                    local_ci.check_policy(root)

    def test_local_sources_and_nonexecutable_reference_files_are_allowed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            local_ci.check_policy(root)
            (root/'.github/workflows').mkdir(parents=True)
            (root/'.github/workflows/README.md').write_text('Local CI only')
            (root/'docs').mkdir()
            (root/'docs/example.yml').write_text('reference only')
            local_ci.check_policy(root)

    def test_forbidden_workflow_stops_main_before_any_command(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'.github/workflows').mkdir(parents=True)
            (root/'.github/workflows/ci.yml').write_text('on: push\njobs: {}\n')
            with patch.object(local_ci, 'ROOT', root), patch.object(local_ci.subprocess, 'run') as run:
                with self.assertRaisesRegex(ValueError, 'Local-only CI'):
                    local_ci.main()
                run.assert_not_called()

    def test_child_failure_stops_later_commands_and_success_output(self):
        error = local_ci.subprocess.CalledProcessError(1, ['node', '--test'])
        with patch.object(local_ci.subprocess, 'run', side_effect=error) as run, patch('builtins.print') as output:
            with self.assertRaises(local_ci.subprocess.CalledProcessError):
                local_ci.main()
            self.assertEqual(run.call_count, 1)
            output.assert_not_called()


if __name__ == '__main__':
    unittest.main()

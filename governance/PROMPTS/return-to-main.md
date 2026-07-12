# Return to Main Directory

Switch the current working directory back to the workspace root.

## Procedure

```bash
while [ ! -d ".claude" ] && [ "$PWD" != "/" ]; do cd ..; done
```

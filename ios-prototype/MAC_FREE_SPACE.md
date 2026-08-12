# Free Mac disk space (MindCraft)

I (the cloud agent) **cannot delete files on your Mac**. Use this checklist + script.

## 1) Fast interactive cleanup (recommended)

In Terminal:

```bash
cd ~/Developer/mindcraft
# if pull fails for space, open System Settings → Storage first
curl -fsSL https://raw.githubusercontent.com/KoKa-Akshat/mindcraft/main/ios-prototype/scripts/free-mac-space.sh -o /tmp/free-mac-space.sh
bash /tmp/free-mac-space.sh
```

It lists sizes and asks before wiping. Safe targets: Xcode DerivedData, SPM, VS Code/Cursor caches, npm/Homebrew, Chrome/Slack/Spotify caches, Trash, old simulators.

## 2) Click UI list (System Settings)

1. **Apple menu → System Settings → General → Storage**
2. Wait for categories to finish calculating.
3. Click each row and remove only junk:

| Storage row | What to do | Safe? |
|---|---|---|
| **Applications** | Delete games / apps you never open. Keep **Xcode**, **Cursor**, browser, Terminal. | Yes if unused |
| **Documents** | Clear huge Downloads / old zip / screen recordings you don’t need | Yes if unused |
| **iOS Files** / **Developer** | Remove old device support / simulators if offered | Yes |
| **System Data** | After script, reboot; Apple often shrinks this | Indirect |
| **Trash** | Empty Trash | Yes |

### Apps usually safe to remove (only if you don’t use them)

- Old games, random utilities, unused Electron apps  
- Duplicate browsers you never open  
- Android Studio / Flutter / IntelliJ if you’re not building those  
- Old Adobe / creative suites you abandoned  

### Do **not** delete

- **Xcode**  
- **Cursor** (or VS Code if that’s your editor)  
- Your `~/Developer/mindcraft` folder  
- Keychain / Passwords  

## 3) After you have several GB free — fix the build

```bash
cd ~/Developer/mindcraft && git pull origin main
bash ios-prototype/scripts/fix-xcode-build.sh
```

That script quits Xcode, ensures the MyScript stub exists, clears wedged
DerivedData/SPM caches, resolves Firebase/GoogleSignIn from the CLI, and
typechecks the app. When it prints `BUILD SUCCEEDED`, open Xcode and Cmd+R.

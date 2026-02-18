# discord quest completer

a script that runs inside the discord desktop app and automatically completes active quests by hooking into discord's internal modules and spoofing progress directly to discord's api.

---

## supported quest types

| quest type | works in browser |
|---|---|
| `watch_video` | yes |
| `watch_video_on_mobile` | yes |
| `play_on_desktop` | no, desktop only |
| `stream_on_desktop` | no, desktop only |
| `play_activity` | yes |

---

## requirements

- discord desktop app installed on your pc
- a quest you have already accepted and enrolled in

---

## how to use

1. open the discord desktop app
2. accept a quest you want to complete
3. press `ctrl + shift + i` to open the developer console
4. go to the **console** tab
5. paste the full contents of `discord.js` and press `enter`
6. wait for the script to finish, progress is logged in the console

for `stream_on_desktop` quests you need at least one other person in a voice channel with you.

---

## how it works

the script hooks into discord's webpack module system and accesses internal stores such as `questsstore`, `runninggamestore`, `applicationstreamingstore`, and `fluxdispatcher` to simulate game activity, fake streams, or send video progress directly to discord's api. it automatically detects the discord bundle version and adjusts accordingly.

---

if this helped you, consider leaving a star on the repository.

---

## disclaimer

**use at your own risk.**

this script violates [discord's terms of service](https://discord.com/terms). using it may result in your account being suspended or permanently banned. the author takes no responsibility for any consequences including account termination or loss of rewards. by running this script you accept full responsibility for your actions.

*this project is not affiliated with or endorsed by discord inc.*

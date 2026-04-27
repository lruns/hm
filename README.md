# Happy Math

> Can you keep the mathematical expressions in your head and use them to select numbers for a short time? Yes? Well! Full ahead!

[![Play Store](https://img.shields.io/badge/Google_Play-414141?style=for-the-badge&logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=ru.neyvan.hm)
[![Itch.io](https://img.shields.io/badge/Itch-%23FF0B34.svg?style=for-the-badge&logo=Itch.io&logoColor=white)](https://lruns.itch.io/hm)

[![Download Desktop](https://img.shields.io/badge/Download-Desktop_version-009639)](https://github.com/lruns/hm/releases/latest)

## Description

The idea of the game is simple. The player must keep up to click on the numbers that appear on the circle display for a limited period of time. He must do it in accordance with the conditions at the beginning of the level. Do you think it is easy? Not really. The player should consider different bonuses and penalties. In addition, numbers will change faster and conditions will become more difficult with each level.

## How to play

The game is divided into episodes, and each can contain from 3 to 5 levels. After completing all the levels of one episode, the player goes to the next. If a player loses all his lives during the passing episode, he will have to start over this episode. The player has 5 lives at the beginning of the game. The player gets one life for every 1000 game points.

At the beginning of each level the player has game conditions by which he must need to select a number on the circle display. He has to select the true number in a short time. If the player clicks on the correct number or misses the wrong one, he earns game points (for every number he earns 10 points * episode level, for example, in the first episode he earns 10 points, in the second - 20 points and so on). Otherwise, he loses his life.

As well, there are surprises in the game. Surprises are good (bonuses, for example, extra lives or points, time dilation, explosion of numbers) and bad (penalties, for example, reduction of lives or points, different distortions of the game screen).

Let's look at an example. Suppose that according to the game condition the numbers should be divided by 3. And game start the count from 1 and then add 2 to each next number (that is, it will be 1, 3, 5 ...). So, the player should click on 3, 9, 15, 21 and so on until the end of the game, because these numbers are divided by 3. But if the player chooses 5, then he will lose his life.

## Development

**Stack:** Java 17, [libGDX 1.14.0](https://libgdx.com), Gradle 8

### Requirements

- JDK 17+
- Android SDK (for Android build)

### Run

**Desktop:**
```bash
gradlew lwjgl3:run
```

**Android** — open project in Android Studio and run, or:
```bash
gradlew android:installDebug
```

**Web (GWT):**
```bash
gradlew html:superDev
```
Then open `http://localhost:8080` in Chrome.  
`superDev` — development mode with hot-reload: after code changes press the reload button in the browser and the game recompiles without restarting the server. For a production build use `gradlew html:dist` — result will be in `html/build/dist/`.

### Level editor
```bash
gradlew lwjgl3:runEditor
```

> **TODO:** Figure out how saving works in the level editor — where the `.lvl` files end up and how to load them back. Check `core/src/ru/neyvan/hm/levels/` sources.

## TODO

- [ ] Level editor: figure out save/load flow — where levels are stored, how to load them into the game
- [ ] Game UX overhaul: rules are too complex for a new player, nobody reads a wall of text. Need to teach the player gradually through gameplay (first level = trivial condition, difficulty grows step by step)
- [ ] Level editor UX: needs to be usable without knowing the code

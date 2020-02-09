package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonValue;

import ru.neyvan.hm.Player;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.surprises.Surprise;

// Contain current game (or saved game) of player
public class GameData {

    public int lifes;
    public int sd
    public int scores;
    public int countMove;
    public int countEffects;
    public int currentNumber;
    public Surprise currentSurprise;
    public float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;
    public int i_level;
    public int i_episode;
    public float progress; //0.0 - 1.0

    public boolean isNowSurprise(){
        return currentSurprise != null;
    }

}

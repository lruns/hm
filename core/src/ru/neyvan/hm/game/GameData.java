package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.JsonValue;

import ru.neyvan.hm.Player;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.surprises.Surprise;

// Contain current game (or saved game) of player
public class GameData {

    public int lifes;
    public int score;

    public LevelNumber levelNumber;
    public Symbol currentSymbol;

    //private boolean gameExist;
    public int countMove;
    public int countEffects;
    public float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;

    public void createGame(Level level){
        this.levelNumber = levelNumber;
        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentSymbol = new Symbol(level.getFirstNumber());
        countMove = 0;
        countEffects = 0;
    }

}

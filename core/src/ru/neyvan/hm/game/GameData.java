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
    public int scores;

    public int i_level;
    public int i_episode;
    public Level level;

    public boolean gameExist;
    public int countMove;
    public int countEffects;
    public int currentNumber;
    public Surprise currentSurprise;
    public float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;
   
    public float progress; //0.0 - 1.0

    public void newGame(int episode){
        i_episode = episode;
        i_level = 1;
        load();
    }
    public void loadGame(){
        //load data
        if(gameExist == false)
            load();
    }
    public void nextLevel(){
        i_level++;
    }
    private void load(){
        level = LevelLoader.loadLevel(i_episode, i_level);
        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentNumber = level.getFirstNumber();
        countMove = 0;
        countEffects = 0;
        gameExist = true;
    }

    public boolean isNowSurprise(){
        return currentSurprise != null;
    }

    



}

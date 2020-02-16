package ru.neyvan.hm.game;

import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelNumber;

// Contain current game (or saved game) of player
public class GameData {

    public int lifes;
    public int score;

    public int number;
    public LevelNumber levelNumber;
    public Symbol currentSymbol;

    //private boolean gameExist;
    public int countMove;
    public int countEffects;
    public float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;


    public GameData(Level level){
        this.levelNumber = level.getLevelNumber();
        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentSymbol = new Symbol(level.getFirstNumber());
        lifes = 5;
        score = 0;
        countMove = 0;
        countEffects = 0;
    }

    public void updateTimeStep(){
        speedChangeTS += accelerationSpeedChangeTS;
        timeAfterStep -= speedChangeTS;
        timeStep -= speedChangeTS;
    }

}

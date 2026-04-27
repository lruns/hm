package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;

import java.util.ArrayList;

import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.surprises.Surprise;

// Contain current game (or saved game) of player
public class GameData {

    public int lifes;
    public int score;
    public int accumulatedScore;

    public int number;
    public LevelNumber levelNumber;
    public Symbol currentSymbol;

    //private boolean gameExist;
    public int countMove;
    public int countEffects;
    public float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;
    public ArrayList<Surprise> surprises;
    public ArrayList<Integer> places;


    public GameData(){
        //not used!!! Only for json serialization
    }

    public GameData(Level level){
        nextLevel(level);
        lifes = 5;
        score = 0;
        accumulatedScore = 0;
    }

    public void nextLevel(Level level){
        this.levelNumber = level.getLevelNumber();
        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentSymbol = new Symbol(level.getFirstNumber());
        surprises = level.getSurprises();
        places = level.getListOfPlacesSurp();
        countMove = 0;
        countEffects = 0;
        if (level.isFixedCounting()) {
            currentSymbol.setNumber(level.getFixedNumbers().get(countMove));
        }else{
            number = level.getFirstNumber();
            currentSymbol.setNumber(number);
        }
        Gdx.app.debug("Game.firstNumber", "First number:" + currentSymbol.getNumber());
        countMove++;
    }

    public void updateTimeStep(){
        speedChangeTS += accelerationSpeedChangeTS;
        timeAfterStep -= speedChangeTS;
        timeStep -= speedChangeTS;
    }

}

package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.MathUtils;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.levels.Check;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelLoader;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.PlayScreen;


public class Game {

    private PlayScreen playScreen;


    // Heart of game information
    private GameData gameData;
    private Level level;
    private GameDataLoader gameDataLoader;
    private LevelLoader levelLoader;


    public Game(PlayScreen playScreen) {
        gameDataLoader = new GameDataLoader();
        levelLoader = new LevelLoader();
    }

    public void createGame(LevelNumber levelNumber) {
        level = levelLoader.load(levelNumber);
        gameData = new GameData(level);
    }


    public void loadGame() {
        gameData = gameDataLoader.load();
        level = levelLoader.load(getLevelNumber());
    }

    public void startGame() {

    }

    public void saveGame() {
    }

    public void dispose() {
    }

    public Level getLevel() {
        return level;
    }




    public int getLifes(){
        return gameData.lifes;
    }
    public int getScore(){
        return gameData.score;
    }
    public LevelNumber getLevelNumber(){
        return gameData.levelNumber;
    }
    public Symbol getSymbol(){
        return gameData.currentSymbol;
    }
    public float getTimeWait(){
        return gameData.timeStep;
    }
    public float getTimeChange (){
        return  0.5f * gameData.timeAfterStep;
    }
    public float getTimeReaction(){
        return  0.5f * gameData.timeAfterStep;
    }
    public float getProgress(){
        Gdx.app.debug("Progress:", " "+ (float) gameData.countMove / level.getCountOfMoves());
        return  (float) gameData.countMove / level.getCountOfMoves();
    }

    public void increaseLifes(int delta) {
        gameData.lifes += Math.abs(delta);
    }
    public void increaseScore() {
        gameData.score += gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
    }
    public void increaseScore(int delta) {
        gameData.score += Math.abs(delta);
    }

    public void decreaseLifes(int delta) {
        gameData.lifes -= Math.abs(delta);
    }
    public void decreaseScore() {
        gameData.score -= gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
    }
    public void decreaseScore(int delta) {
        gameData.score -= Math.abs(delta);
    }

    public boolean checkClick() {
        for (Check check : level.getChecksOfMove()) {
            check.makeOperation(level.getTerms(), level.getChecksOfMove(), gameData.currentSymbol.getNumber());
        }
        return level.getChecksOfMove().get(level.getChecksOfMove().size() - 1).getResult();
    }


    public boolean isPlayerLose() {
        return  gameData.lifes <= 0;
    }

    public boolean isGameFinished() {
        return gameData.countMove >= level.getCountOfMoves();
    }

    public void firstNumber() {
        if (level.isFixedCounting()) {
            gameData.currentSymbol.setNumber(level.getFixedNumbers().get(gameData.countMove));
        }else{
            gameData.number = level.getFirstNumber();
            gameData.currentSymbol.setNumber(gameData.number);
        }
        Gdx.app.debug("Game.firstNumber", "First number:" + gameData.currentSymbol.getNumber());
        gameData.countMove++;
    }

    // Change number (or surprise) for next turn. Also change time step (only for numbers).

    public void nextTurn() {
        if (level.getSurprises().size() != 0 && level.isRandomSurpriseMove()) {
            if (MathUtils.random() > 0.9 || (level.getCountOfMoves() - gameData.countMove < 10)) {
                int i = MathUtils.random(0, level.getSurprises().size() - 1);
                gameData.currentSymbol.setSurprise(level.getSurprises().get(gameData.countEffects));
                level.getSurprises().remove(i);
                Gdx.app.debug("Game.nextTurn", "Set random surprise:" + gameData.currentSymbol.getSurpise().toString());
                return;
            }
        }
        for (int place : level.getListOfPlacesSurp()) {
            if (place == gameData.countMove) {
                if (level.isOutOfOrderAppearanceSurprise()) {
                    int i = MathUtils.random(0, level.getSurprises().size() - 1);
                    gameData.currentSymbol.setSurprise(level.getSurprises().get(gameData.countEffects));
                    level.getSurprises().remove(i);
                    Gdx.app.debug("Game.nextTurn", "Set placed out order surprise:" + gameData.currentSymbol.getSurpise().toString());
                    return;
                }
                gameData.currentSymbol.setSurprise(level.getSurprises().get(gameData.countEffects));
                gameData.countEffects++;
                Gdx.app.debug("Game.nextTurn", "Set placed surprise:" + gameData.currentSymbol.getSurpise().toString());
                return;
            }
        }
        if (level.isFixedCounting()) {
            gameData.currentSymbol.setNumber(level.getFixedNumbers().get(gameData.countMove));
        } else {
            gameData.number += level.getDeltaNumbers();
            gameData.currentSymbol.setNumber(gameData.number);
        }
        gameData.countMove++;
        gameData.updateTimeStep();
        Gdx.app.debug("Game.nextTurn", "Set number:" + gameData.currentSymbol.getNumber());

    }

    public void nextLevel() {
    }
}

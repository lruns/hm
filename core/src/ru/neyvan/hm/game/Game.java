package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.MathUtils;

import java.util.Iterator;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.Player;
import ru.neyvan.hm.levels.Check;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelLoader;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.PlayScreen;


public class Game {

    // Heart of game information
    private GameData gameData;
    private Level level;
    private GameDataLoader gameDataLoader;
    private LevelLoader levelLoader;


    public Game() {
        gameDataLoader = new GameDataLoader();
        levelLoader = new LevelLoader();
    }

    public void createGame(LevelNumber levelNumber) {
        HM.game.player.createGame();
        level = levelLoader.load(levelNumber);
        gameData = new GameData(level);
    }


    public void loadGame() {
        gameData = gameDataLoader.load();
        level = levelLoader.load(getLevelNumber());
    }

    public void saveGame() {
        if(isPlayerLose()) HM.game.player.deleteGame();
        else gameDataLoader.save(gameData);

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
        //return gameData.countMove >= 5;
    }

    // Change number (or surprise) for next turn. Also change time step (only for numbers).
    public void nextTurn() {
        if (gameData.surprises.size() != 0 && level.isRandomSurpriseMove()) {
            if (MathUtils.random() > 0.9 || (level.getCountOfMoves() - gameData.countMove < 10)) {
                int i = MathUtils.random(0, gameData.surprises.size() - 1);
                gameData.currentSymbol.setSurprise(gameData.surprises.get(gameData.countEffects));
                gameData.surprises.remove(i);
                Gdx.app.debug("Game.nextTurn", "Set random surprise:" + gameData.currentSymbol.getSurpise().toString());
                return;
            }
        }
       // Iterator<int> placeIterator
        if (gameData.countEffects < gameData.surprises.size()) {
            for (int place : level.getListOfPlacesSurp()) {
                if (place == gameData.countMove) {

                    if (level.isOutOfOrderAppearanceSurprise()) {
                        int i = MathUtils.random(0, gameData.surprises.size() - 1);
                        gameData.currentSymbol.setSurprise(gameData.surprises.get(gameData.countEffects));
                        gameData.surprises.remove(i);
                        Gdx.app.debug("Game.nextTurn", "Set placed out order surprise:" + gameData.currentSymbol.getSurpise().toString());
                        return;
                    }
                    gameData.currentSymbol.setSurprise(gameData.surprises.get(gameData.countEffects));
                    gameData.countEffects++;
                    Gdx.app.debug("Game.nextTurn", "Set placed surprise:" + gameData.currentSymbol.getSurpise().toString());
                    return;
                }
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
        LevelNumber levelNumber;
        if(isEpisodeComplete()){
            HM.game.player.completeEpisode(gameData.levelNumber);
            levelNumber = new LevelNumber(gameData.levelNumber.getEpisode()+1, 1);
        }else{
            levelNumber = new LevelNumber(gameData.levelNumber.getEpisode(), gameData.levelNumber.getLevel()+1);
        }
        level = levelLoader.load(levelNumber);
        gameData.nextLevel(level);
    }

    // Return true, if you played last level of LAST episode and won
    public boolean isAllGameComplete(){
        return gameData.levelNumber.isLastGame();
    }

    public boolean isEpisodeComplete() {
        return gameData.levelNumber.isLastLevel();
    }
}

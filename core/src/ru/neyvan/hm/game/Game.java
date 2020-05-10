package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.MathUtils;

import java.util.Iterator;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.levels.Check;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelLoader;
import ru.neyvan.hm.levels.LevelNumber;


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
        if(level.isFixedCounting()){
            Gdx.app.debug("Progress:", " " + (float) gameData.countMove / level.getFixedNumbers().size());
            return (float) gameData.countMove / level.getFixedNumbers().size();
        }else {
            Gdx.app.debug("Progress:", " " + (float) gameData.countMove / level.getCountOfMoves());
            return (float) gameData.countMove / level.getCountOfMoves();
        }
    }
    public void increaseLifes(int delta) {
        gameData.lifes += Math.abs(delta);
    }
    public void increaseScore() {
        gameData.score += gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
        gameData.accumulatedScore += gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
    }
    public void increaseScore(int delta) {
        gameData.score += Math.abs(delta);
        gameData.accumulatedScore += Math.abs(delta);
    }
    public void decreaseLifes(int delta) {
        gameData.lifes -= Math.abs(delta);
    }
    public void decreaseScore() {
        gameData.score -= gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
        gameData.accumulatedScore -= gameData.levelNumber.getEpisode() * Constants.SCORE_DELTA;
    }
    public void decreaseScore(int delta) {
        gameData.score -= Math.abs(delta);
        gameData.accumulatedScore -= Math.abs(delta);
    }

    public boolean checkClick() {
        for (Check check : level.getChecksOfMove()) {
            check.makeOperation(level.getTerms(), level.getChecksOfMove(), gameData.currentSymbol.getNumber());
        }
        return level.getChecksOfMove().get(level.getChecksOfMove().size() - 1).getResult();
    }

    public boolean isPlayerLose() {
        if(Constants.IMMORTALITY)
            return  false;
        else
            return gameData.lifes <= 0;
    }

    public boolean isGameFinished() {
        if (Constants.FAST_GAME){
            return gameData.countMove >= Constants.FAST_GAME_MAX_COUNT;
        }else{
            if(level.isFixedCounting()){
                return gameData.countMove >= level.getFixedNumbers().size();
            }else{
                return gameData.countMove >= level.getCountOfMoves();
            }
        }       
    }

    private Iterator<Integer> placeIterator;
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
            placeIterator = gameData.places.iterator();
            while (placeIterator.hasNext()){
                int place = placeIterator.next();
                if (place == gameData.countMove) {

                    if (level.isOutOfOrderAppearanceSurprise()) {
                        int i = MathUtils.random(0, gameData.surprises.size() - 1);
                        gameData.currentSymbol.setSurprise(gameData.surprises.get(gameData.countEffects));
                        gameData.surprises.remove(i);
                        gameData.countEffects++;
                        placeIterator.remove();
                        Gdx.app.debug("Game.nextTurn", "Set placed out order surprise:" + gameData.currentSymbol.getSurpise().toString());
                        return;
                    }
                    gameData.currentSymbol.setSurprise(gameData.surprises.get(gameData.countEffects));
                    gameData.countEffects++;
                    placeIterator.remove();
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
            levelNumber = new LevelNumber(gameData.levelNumber.getEpisode()+1, 1);
            HM.game.player.openEpisode(levelNumber);
        }else{
            levelNumber = new LevelNumber(gameData.levelNumber.getEpisode(), gameData.levelNumber.getLevel()+1);
        }
        level = levelLoader.load(levelNumber);
        gameData.nextLevel(level);
        saveGame();
    }

    // Return true, if you played last level of LAST episode and won
    public boolean isAllGameComplete(){
        return gameData.levelNumber.isLastGame();
    }

    public boolean isEpisodeComplete() {
        return gameData.levelNumber.isLastLevel();
    }

    // Собирает информацию о уровне для игрока
    public String getLevelDescription() {
        StringBuilder text = new StringBuilder();

        // Информация о номере уровня
        text.append(HM.game.bundle.format("levelNumber", gameData.levelNumber.getEpisode(), gameData.levelNumber.getLevel()));
        text.append("\n\n");

        // Показываем пройденный прогресс, если игрок продолжил игру с главного меню
        if(gameData.countMove != 1) {
            text.append(HM.game.bundle.format("progress", getProgress() * 100f));
            text.append("\n\n");
        }

        // Условия прохождения уровня
        text.append(HM.game.bundle.get("conditionStart"));
        text.append("\n\n");
        text.append(HM.game.bundle.get("conditionMiddle"));
        text.append(level.getChecksOfMove().get(level.getChecksOfMove().size()-1).printDescription(level.getTerms(), level.getChecksOfMove()));
        text.append("\n\n");
        text.append(HM.game.bundle.get("conditionEnd"));
        text.append("\n\n");

        // Второстепенные условия
        text.append(HM.game.bundle.get("alsoCondition"));
        text.append("\n\n");

        // Вариант появления чисел
        if(level.isFixedCounting()){
            text.append(HM.game.bundle.get("fixedCounting"));
            text.append("\n");
        }else{
            text.append(HM.game.bundle.format("notFixedCounting", level.getFirstNumber(), level.getDeltaNumbers()));
            text.append("\n");
        }

        // Время ходов
        if(level.getSpeedChangeTS() == 0 && level.getAccelerationSpeedChangeTS() == 0){
            text.append(HM.game.bundle.format("timeStepWithoutSpeed", level.getTimeStep(), level.getTimeAfterStep()));
            text.append("\n\n");
        }else{
            if(level.getAccelerationSpeedChangeTS() != 0){
                text.append(HM.game.bundle.format("timeStepWithAcceleration", level.getTimeStep(), level.getTimeAfterStep(),
                        level.getSpeedChangeTS(), level.getSpeedChangeTS()+level.getAccelerationSpeedChangeTS()));
                text.append("\n\n");
            }else{
                text.append(HM.game.bundle.format("timeStepWithSpeed", level.getTimeStep(), level.getTimeAfterStep(),
                        level.getSpeedChangeTS()));
                text.append("\n\n");
            }
        }

        // Информация о введении в игру новых сюрпризов и вариантов условий
        String newText = HM.game.bundle.get("level"+gameData.levelNumber.getEpisode()+"."+gameData.levelNumber.getLevel());
        if(!newText.equals("")){
            text.append(HM.game.bundle.get("levelNew"));
            text.append("\n\n");
            text.append(newText);
            text.append("\n\n");
        }

        return text.toString();
    }

    public boolean isAccumulatedScoreLimit() {
        if(gameData.accumulatedScore > 1000) {
            gameData.accumulatedScore -= 1000;
            gameData.lifes++;
            return true;
        }
        return false;
    }
}

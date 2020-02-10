package ru.neyvan.hm.game;

import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.levels.LevelLoader;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.states.BeginState;
import ru.neyvan.hm.states.ChanceState;
import ru.neyvan.hm.states.ChangeState;
import ru.neyvan.hm.states.ExplosionState;
import ru.neyvan.hm.states.FullFreezingState;
import ru.neyvan.hm.states.LoseState;
import ru.neyvan.hm.states.PortalState;
import ru.neyvan.hm.states.ReactionState;
import ru.neyvan.hm.states.State;
import ru.neyvan.hm.states.WaitState;
import ru.neyvan.hm.states.WinState;

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
        gameData.createGame(level);
    }


    public void loadGame() {
        gameData = gameDataLoader.load();
        levelLoader = levelLoader.load(gameData.getLevelNumber());
    }

    public void startGame() {

    }

    public void update(float delta) {
    }

    public void saveGame() {
    }

    public void dispose() {
    }

    public void nextState(State state, float time){
        state = null;
        state.start(time);
    }



    public GameData getGameData() {
        return gameData;
    }

    public Level getLevel() {
        return level;
    }

    public PlayScreen getPlayerScreen() {
        return playScreen;
    }

    public void firstNumber() {
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
        return  gameData.countMove / level.getCountOfMoves();
    }

    public void increaseLifes(int delta) {
        gameData.lifes += Math.abs(delta);
    }

    public void increaseScore(int delta) {
        gameData.score += Math.abs(delta);
    }

    public void dicreaseLifes(int delta) {
        gameData.lifes -= Math.abs(delta);
    }

    public void dicreaseScore(int delta) {
        gameData.score -= Math.abs(delta);
    }

    public boolean checkClick() {
    }


    public boolean isPlayerLose() {
        return  gameData.lifes < 0;
    }

    public boolean isGameFinished() {
        return gameData.countMove >= level.getCountOfMoves();
    }

    public void nextTurn() {
    }
}

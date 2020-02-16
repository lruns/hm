package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.utils.Timer;

import java.util.ArrayList;
import java.util.List;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.game.GUI;
import ru.neyvan.hm.game.Game;
import ru.neyvan.hm.impacts.ChangeSpeedTimeImpact;
import ru.neyvan.hm.impacts.HelpSurpriseImpact;
import ru.neyvan.hm.impacts.Impact;
import ru.neyvan.hm.impacts.RotationImpact;
import ru.neyvan.hm.impacts.ScreenEffectsImpact;
import ru.neyvan.hm.impacts.TransferenceImpact;
import ru.neyvan.hm.impacts.WarpSurpriseImpact;
import ru.neyvan.hm.levels.LevelNumber;
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
import ru.neyvan.hm.surprises.Surprise;


/**
 * Created by AndyGo on 08.07.2017.
 */

// This is core of game, which control game, gui and input processes
public class PlayScreen implements Screen {

    private Game game;
    private GUI gui;


    // Transition States - responsible for game process; and times for some states
    public final float beginStateTime = 3f;
    public final float changeStateTime = 10000f;
    public final float winStateTime = 3f;
    public final float loseStateTime = 3f;

    private State state;
    private BeginState beginState;
    private WaitState waitState;
    private ReactionState reactionState;
    private ChangeState changeState;
    private ExplosionState explosionState;
    private FullFreezingState fullFreezingState;
    private WinState winState;
    private PortalState portalState;
    private ChanceState chanceState;
    private LoseState loseState;

    // Impact States - responsible for influence on game with different effect INDEPENDENTLY of game process
    private List<Impact> impacts;
    private ChangeSpeedTimeImpact changeSpeedTimeImpact;
    private HelpSurpriseImpact helpSurpriseImpact;
    private RotationImpact rotationImpact;
    private ScreenEffectsImpact screenEffectsImpact;
    private TransferenceImpact transferenceImpact;
    private WarpSurpriseImpact warpSurpriseImpact;

    private boolean pause = true;
    private boolean gamePause = true;

    // New game
    public PlayScreen(LevelNumber levelNumber){
        initializeStatesAndImpacts();
        game = new Game(this);
        gui = new GUI(this);
        game.createGame(levelNumber);
        gui.prepareLevel();

    }

    // Load game
    public PlayScreen(){
        initializeStatesAndImpacts();
        game = new Game(this);
        gui = new GUI(this);
        game.loadGame();
        gui.prepareLevel();

    }

    @Override
    public void show() {
        InputProcessor backProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.ESCAPE) || (keycode == Input.Keys.BACK)) {
                    if (!gamePause) return gamePause();
                    else return resumeGame();
                }
                return false;
            }
        };
        InputProcessor clickProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if (keycode == Input.Keys.SPACE) return clickOnDisplay();
                return false;
            }
        };
        InputMultiplexer multiplexer = new InputMultiplexer(getGui().getStage(), backProcessor, clickProcessor);
        Gdx.input.setInputProcessor(multiplexer);

        gamePause = false;
        pause = false;

        nextState(beginState, beginStateTime);
        gamePause();
    }

    @Override
    public void render(float delta) {
        if(pause == true) return;
        if(gamePause == false){
            state.update(delta);
            for (Impact impact: impacts) {
                impact.update(delta);
            }
            gui.update(delta);
        }else{
            gui.updateGamePause(delta);
        }
        gui.render(delta);
    }

    @Override
    public void resize(int width, int height) {
        gui.resize(width, height);
    }

    //pause only for game
    public boolean gamePause(){
        if(gamePause || state instanceof PortalState) return false;
        gamePause = true;
        gui.toGamePause();
        return true;
    }

    // pause for all
    @Override
    public void pause() {
        pause = true;
        gamePause();
        game.saveGame();
    }

    public boolean resumeGame(){
        if(!gamePause) return false;
        gamePause = false;
        gui.toResumeGame();
        return true;
    }

    @Override
    public void resume() {
        pause = false;
        //resumeGame();
    }

    @Override
    public void hide() {

    }

    @Override
    public void dispose() {
        game.dispose();
        gui.dispose();
    }

    public boolean clickOnDisplay(){
        if(state instanceof WaitState){
            ((WaitState) state).click();
            return true;
        }
        return false;
    }

    public boolean clickWatchAdd(boolean watch){
        if(state instanceof ChanceState){
            ((ChanceState) state).clickAddmob(watch);
            return true;
        }
        return false;
    }


    public void nextState(State state, float time){
        this.state = state;
        state.start(time);
    }

    public PlayScreen getCore() {
        return this;
    }

    public Game getGame() {
        return game;
    }

    public GUI getGui() {
        return gui;
    }

    public void addImpact(Impact impact, Surprise surprise){
        impacts.add(impact);
        impact.start(surprise);
    }


    public State getState() {
        return state;
    }

    public BeginState getBeginState() {
        return beginState;
    }

    public WaitState getWaitState() {
        return waitState;
    }

    public ReactionState getReactionState() {
        return reactionState;
    }

    public ChangeState getChangeState() {
        return changeState;
    }

    public ExplosionState getExplosionState() {
        return explosionState;
    }

    public FullFreezingState getFullFreezingState() {
        return fullFreezingState;
    }

    public WinState getWinState() {
        return winState;
    }

    public PortalState getPortalState() {
        return portalState;
    }

    public ChanceState getChanceState() {
        return chanceState;
    }

    public LoseState getLoseState() {
        return loseState;
    }


    public ChangeSpeedTimeImpact getChangeSpeedTimeImpact() {
        return changeSpeedTimeImpact;
    }

    public HelpSurpriseImpact getHelpSurpriseImpact() {
        return helpSurpriseImpact;
    }

    public RotationImpact getRotationImpact() {
        return rotationImpact;
    }

    public ScreenEffectsImpact getScreenEffectsImpact() {
        return screenEffectsImpact;
    }

    public TransferenceImpact getTransferenceImpact() {
        return transferenceImpact;
    }

    public WarpSurpriseImpact getWarpSurpriseImpact() {
        return warpSurpriseImpact;
    }

    private void initializeStatesAndImpacts() {
        impacts = new ArrayList<Impact>();

        beginState = new BeginState(this);
        waitState = new WaitState(this);
        reactionState = new ReactionState(this);
        changeState = new ChangeState(this);
        explosionState = new ExplosionState(this);
        fullFreezingState = new FullFreezingState(this);
        winState = new WinState(this);
        portalState = new PortalState(this);
        chanceState = new ChanceState(this);
        loseState = new LoseState(this);

        // Impact States - responsible for influence on game with different effect INDEPENDENTLY of game process
        changeSpeedTimeImpact = new ChangeSpeedTimeImpact(this);
        helpSurpriseImpact = new HelpSurpriseImpact(this);
        rotationImpact = new RotationImpact(this);
        screenEffectsImpact = new ScreenEffectsImpact(this);
        transferenceImpact = new TransferenceImpact(this);
        warpSurpriseImpact = new WarpSurpriseImpact(this);
    }

    public void exit() {
        game.saveGame();
        gui.toResumeGame();
        gamePause = false;
        Gdx.input.setInputProcessor(null);

        float time = 1f;
        gui.disappear(time);
        Timer.schedule(new Timer.Task() {
            @Override
            public void run() {
                HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_ELASTIC));
            }
        },time * 0.7f);
    }
}

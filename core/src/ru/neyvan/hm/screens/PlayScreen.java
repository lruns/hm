package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.glutils.FrameBuffer;
import com.badlogic.gdx.utils.Timer;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.game.GUI;
import ru.neyvan.hm.game.Game;
import ru.neyvan.hm.game.PortalView;
import ru.neyvan.hm.game.ScreenTransition;
import ru.neyvan.hm.impacts.ChangeSpeedTimeImpact;
import ru.neyvan.hm.impacts.HelpSurpriseImpact;
import ru.neyvan.hm.impacts.Impact;
import ru.neyvan.hm.impacts.RotationImpact;
import ru.neyvan.hm.impacts.ScreenEffectsImpact;
import ru.neyvan.hm.impacts.TransferenceImpact;
import ru.neyvan.hm.impacts.WarpSurpriseImpact;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.states.AllGameComplete;
import ru.neyvan.hm.states.BeginState;
import ru.neyvan.hm.states.ChanceState;
import ru.neyvan.hm.states.ChangeState;
import ru.neyvan.hm.states.EpisodeCompleteState;
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

    private PortalView portalView;
    private ScreenTransition screenTransition;
    private FrameBuffer firstFrameBuffer;
    private FrameBuffer secondFrameBuffer;


    // Transition States - responsible for game process; and times for some states
    public final float beginStateTime = 2f;
    public final float chanceStateTime = 10000f;
    public final float winStateTime = 2f;
    public final float loseStateTime = 3f;
    public final float portalStateTime = 6f;
    public final float allGameCompleteStateTime = 10f;
    public final float episodeCompleteStateTime = 10f;

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
    private AllGameComplete allGameComplete;
    private EpisodeCompleteState episodeCompleteState;

    // Impact States - responsible for influence on game with different effect INDEPENDENTLY of game process
    private List<Impact> impacts;
    private Iterator<Impact> impactIterator;
    private Impact impact;
    private ChangeSpeedTimeImpact changeSpeedTimeImpact;
    private HelpSurpriseImpact helpSurpriseImpact;
    private RotationImpact rotationImpact;
    private ScreenEffectsImpact screenEffectsImpact;
    private TransferenceImpact transferenceImpact;
    private WarpSurpriseImpact warpSurpriseImpact;

    private boolean pause = true;
    private boolean gamePause = true;
    private float multiplierTime = 1f;

    private void  init(){
        portalView = new PortalView();
        screenTransition = new ScreenTransition();

        initializeStatesAndImpacts();
        game = new Game();
        gui = new GUI(this);
    }
    // New game
    public PlayScreen(LevelNumber levelNumber){
        init();
        game.createGame(levelNumber);
        gui.prepareLevel();

    }

    // Load game
    public PlayScreen(){
        init();
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

        getGui().setLevelDescription(getGame().getLevelDescription());
        nextState(beginState, beginStateTime);
    }
    @Override
    public void render(float delta) {
        delta = delta * multiplierTime;
        if(pause == true) return;

        if(gamePause == false) {
            if (state != null) {
                state.update(delta);
                impactIterator = impacts.iterator();
                while(impactIterator.hasNext()){
                    impact = impactIterator.next();
                    impact.update(delta);
                    if(impact.isEnd()) impactIterator.remove();
                }
            }
            gui.update(delta);
        }else{
            gui.updateGamePause(delta);
        }

        if(portalState.isTransition()){
            firstFrameBuffer.begin();
            gui.render(delta);
            firstFrameBuffer.end();
            secondFrameBuffer.begin();
            portalView.render(delta);
            secondFrameBuffer.end();
            // render transition effect to screen
            if(portalState.isEnteringToPortal())
                screenTransition.render(firstFrameBuffer.getColorBufferTexture(),
                    secondFrameBuffer.getColorBufferTexture(), portalState.getTransitionProgress());
            else
                screenTransition.render(secondFrameBuffer.getColorBufferTexture(),
                        firstFrameBuffer.getColorBufferTexture(), portalState.getTransitionProgress());

        } else if(portalState.inPortal()){
            portalView.render(delta);
        } else{
            gui.render(delta);
        }

    }


    @Override
    public void resize(int width, int height) {
        gui.resize(width, height);
        screenTransition.resize(Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        portalView.resize(width, height);
        if(firstFrameBuffer != null) firstFrameBuffer.dispose();
        if(secondFrameBuffer != null) secondFrameBuffer.dispose();
        firstFrameBuffer = new FrameBuffer(Pixmap.Format.RGB888, Gdx.graphics.getWidth(), Gdx.graphics.getHeight(), false);
        secondFrameBuffer = new FrameBuffer(Pixmap.Format.RGB888, Gdx.graphics.getWidth(), Gdx.graphics.getHeight(), false);
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
        gui.dispose();
        portalView.dispose();
        if(firstFrameBuffer != null) firstFrameBuffer.dispose();
        if(secondFrameBuffer != null) secondFrameBuffer.dispose();
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
        for(Impact impact2 : impacts){
            if(impact == impact2){
                impact.end();
            }
        }
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

    public AllGameComplete getAllGameCompleteState() {
        return allGameComplete;
    }

    public State getEpisodeCompleteState() {
        return episodeCompleteState;
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
        impactIterator = impacts.iterator();

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
        allGameComplete = new AllGameComplete(this);
        episodeCompleteState = new EpisodeCompleteState(this);

        // Impact States - responsible for influence on game with different effect INDEPENDENTLY of game process
        changeSpeedTimeImpact = new ChangeSpeedTimeImpact(this);
        helpSurpriseImpact = new HelpSurpriseImpact(this);
        rotationImpact = new RotationImpact(this);
        screenEffectsImpact = new ScreenEffectsImpact(this);
        transferenceImpact = new TransferenceImpact(this);
        warpSurpriseImpact = new WarpSurpriseImpact(this);
    }

    public void exit() {
        state = null;
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

    public void changeSpeedTime(float multiplierTime) {
        this.multiplierTime = multiplierTime;
    }

    public void resetSpeedTime() {
        this.multiplierTime = 1f;
    }
}

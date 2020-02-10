package ru.neyvan.hm.screens;

import com.badlogic.gdx.Screen;
import com.badlogic.gdx.scenes.scene2d.Stage;

import java.util.List;

import ru.neyvan.hm.game.Game;
import ru.neyvan.hm.game.GUI;
import ru.neyvan.hm.impacts.Impact;
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
import ru.neyvan.hm.surprises.Transference;
import ru.neyvan.hm.surprises.WarpSurprise;

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
    public final float winStateTime = 10000f;

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
    private ChangeSpeedTimeImpact   changeSpeedTimeState;
    private HelpSurpriseImpact      helpSurpriseImpact;
    private RotationImpact          rotationImpact;
    private ScreenEffectsImpact     screenEffectsImpact;
    private TransferenceImpact      transferenceImpact;
    private WarpSurpriseImpact      warpSurpriseImpact;

    private boolean pause = true;
    private boolean gamePause = true;

    // New game
    public PlayScreen(LevelNumber levelNumber){
        initializeStatesAndImpacts();
        game = new Game(this);
        gui = new GUI(this);
        game.createGame(levelNumber);

    }

    // Load game
    public PlayScreen(){
        game = new Game(this);
        gui = new GUI(this);
        game.loadGame();
    }

    @Override
    public void show() {
        gamePause = false;
        pause = false;
        nextState(beginState, beginStateTime);
    }

    @Override
    public void render(float delta) {
        if(pause = true) return;
        if(gamePause == false){
            state.update(delta);
            for (Impact impact: impacts) {
                impact.update(delta);
            }
            game.update(delta);
        }
        gui.render(delta);
    }

    @Override
    public void resize(int width, int height) {
        gui.resize(width, height);
    }

    //pause only for
    public void gamePause(){
        gamePause = true;
        gui.toGamePause();
    }

    // pause for all
    @Override
    public void pause() {
        pause = true;
        gamePause();
        game.saveGame();
    }

    public void resumeGame(){
        gamePause = false;
        gui.toResumeGame();
    }

    @Override
    public void resume() {
        pause = false;
        resumeGame();
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


    public void nextState(State state, float time){
        this.state = state;
        state.start(time);
    }

    public PlayScreen getCore() {
        return core;
    }

    public Game getGame() {
        return game;
    }

    public GUI getGui() {
        return gui;
    }

    public void addImpact(Impact impact){
        impacts.add(impact);
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

    private void initializeStatesAndImpacts() {

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
        changeSpeedTimeState = new ChangeSpeedTimeState(this);
        helpSurpriseImpact = new HelpSurpriseImpact(this);
        rotationImpact = new RotationImpact(this);
        screenEffectsImpact = new ScreenEffectsImpact(this);
        transferenceImpact = new TransferenceImpact(this);
        warpSurpriseImpact = new WarpSurpriseImpact(this);
    }

/*   private SpriteBatch batch;
    private OrthographicCamera camera;
    private StreamEnergy streamEnergy;
    private Shine shine;
    private Texture background;
    private Stage stage;
    private Skin skin;
    private GUI gui;
    private Sides sides;
    private GameCircle gameCircle;
    private BottomPause bottomPause;
    private float timeGUIAnimation;
    private boolean pause;

    private Level level;
    private Json json;
    private FileHandle fileHandle;
    private int currentNumber;
    private int countMove;
    private float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;
    private int countEffects = 0;
    private boolean win = false;
    private boolean clicked = false;
    private Surprise curDisplaySurprise;
    private Explosion explosion;
    public static final int SURPRISE = -1;


    private float timeState;
    private int state;
    //                                STATES OF GAME                                    //
    private static final int START_GAME = 0; // ?
    private static final int EXPECT_CLICK = 1; // Wait click of user on game circle
    private static final int PRAISE_OR_SHAIME = 2; // Show player effects that show he guessed
                                                    // number(surprise) or not
                                                   // and fill bar cirlce (when he click)
    private static final int CHANGE_ON_CIRCLE = 3; // After PRAISE_OR_SHAIME change number(surprise) on next
    private static final int WIN = 41; // Player win -> next level or episode
    private static final int LOSER = 42; // Player lose and we can propose him advertising in exchange for life

    private int lifes;
    private int score;

    private  float debugTime = 0;


    // Start new episode
    public PlayScreen(int clickedEpisode) {

        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentNumber = level.getFirstNumber();
        countMove = -1;

        timeGUIAnimation = 1f;
        state = START_GAME;
        camera = new OrthographicCamera();
        camera.setToOrtho(false, Constants.WIDTH, Constants.HEIGHT);
        batch = new SpriteBatch();
        streamEnergy = new StreamEnergy();
        shine = new Shine();
        background = HM.game.texture.getMenuBackground(level.getI_background());

        stage = new Stage(new FitViewport(Constants.WIDTH, Constants.HEIGHT));
        skin = HM.game.texture.skin;
        gui = new GUI(this, timeGUIAnimation);
        sides = new Sides(stage, timeGUIAnimation);
        gameCircle = new GameCircle(this, timeGUIAnimation);
        normalCircle();
        bottomPause = new BottomPause(this);

        lifes = 20;
        score = 0;
        timeState = 3f;
        gui.setBeginScore(score);
        gui.setLifes(lifes);

    }


    public void show() {
        InputProcessor backProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.ESCAPE) || (keycode == Input.Keys.BACK))
                    if(state != START_GAME) changePause();
                return false;
            }
        };
        InputProcessor clickProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.SPACE) && state == EXPECT_CLICK) clicked = true;
                return false;
            }
        };
        InputMultiplexer multiplexer = new InputMultiplexer(stage, backProcessor, clickProcessor);
        Gdx.input.setInputProcessor(multiplexer);
        streamEnergy.create((int) (camera.viewportWidth / 2), 0, 1f, 0.3f, camera.viewportHeight);
        gui.start();
        sides.start();
        gameCircle.start();
        Gdx.app.debug("Statements", "start START_GAME");
    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClearColor(0, 0, 0, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        update(delta);
        batch.setProjectionMatrix(camera.combined);
        batch.begin();
        batch.draw(background, 0, 0);
        streamEnergy.draw(batch);
        shine.draw(batch);
        batch.end();
        stage.draw();
    }

    public void update(float delta) {
        stage.act(delta);
        gui.update(delta);
        debugTime += delta;

        if(pause)return;
        gameCircle.update(delta);
        streamEnergy.update(delta);
        timeState -= delta;

        switch (state){
            case START_GAME:
                if(timeState > 0) break;
                startGame();
                nextNumberOrSurprise();
                gameCircle.fillBar(timeState * 0.3f);
                Gdx.app.debug("Time", debugTime + " s");
                Gdx.app.debug("Statements", "start EXPECT_CLICK");

                break;
            case EXPECT_CLICK:
                if(timeState<0){
                    if(clicked) circleClicked();
                    else circleNotClicked();
                    state = PRAISE_OR_SHAIME;
                    timeState = timeAfterStep*0.5f;
                    gameCircle.fillBar(timeState * 0.3f);
                    Gdx.app.debug("Time", debugTime + " s");
                    Gdx.app.debug("Statements", "start PRAISE_OR_SHAIME");
                }
                break;
            case PRAISE_OR_SHAIME:
                if(timeState<0){
                    state = CHANGE_ON_CIRCLE;
                    timeState = timeAfterStep*0.5f;
                    gameCircle.resetBar(timeState*0.1f);

                    Gdx.app.debug("Time", debugTime + " s");
                    Gdx.app.debug("Statements", "start CHANGE_ON_CIRCLE");
                }
                break;
            case CHANGE_ON_CIRCLE:
                if (timeState<0){
                    if(win){
                        state = WIN;
                        timeState = 3.0f;
                    }else if(lifes<=0){
                        state = LOSER;
                        timeState = 3.0f;
                    }
                    nextNumberOrSurprise();
                    state = EXPECT_CLICK;
                    speedChangeTS += accelerationSpeedChangeTS;
                    timeStep += speedChangeTS;
                    timeAfterStep += speedChangeTS;
                    clicked = false;
                    timeState = timeStep;
                    gameCircle.fillBar(timeState);
                    normalCircle();
                    Gdx.app.debug("Time", debugTime + " s");
                    Gdx.app.debug("Statements", "start EXPECT_CLICK");
                }
                break;

    }

    public void startGame(){
        state = EXPECT_CLICK; timeState = timeStep;
    }


    private void nextNumberOrSurprise() {
        countMove++;
        if (level.getCountOfMoves() == countMove) {
            win = true;
            return;
        }
        if (level.getSurprises().size() != 0 && level.isRandomSurpriseMove()) {
            if (MathUtils.random() > 0.9 || (level.getCountOfMoves() - countMove < 10)) {
                int i = MathUtils.random(0, level.getSurprises().size() - 1);
                curDisplaySurprise = level.getSurprises().get(countEffects);
                gameCircle.displayNextOnCircle(curDisplaySurprise);
                level.getSurprises().remove(i);
                return;
            }
        }
        for (int place : level.getListOfPlacesSurp()) {
            if (place == countMove) {
                if (level.isOutOfOrderAppearanceSurprise()) {
                    int i = MathUtils.random(0, level.getSurprises().size() - 1);
                    curDisplaySurprise = level.getSurprises().get(countEffects);
                    gameCircle.displayNextOnCircle(curDisplaySurprise);
                    level.getSurprises().remove(i);
                    return;
                }
                curDisplaySurprise = level.getSurprises().get(countEffects);
                gameCircle.displayNextOnCircle(curDisplaySurprise);
                countEffects++;
                return;
            }
        }
        if (level.isFixedCounting()) {
            currentNumber = level.getFixedNumbers().get(countMove);
        } else {
            currentNumber += level.getDeltaNumbers();
        }
        gameCircle.displayNextOnCircle(currentNumber);
    }


    private boolean checkMove(boolean wasClicked) {
        for (Check check : level.getChecksOfMove()) {
            check.makeOperation(level.getTerms(), level.getChecksOfMove(), currentNumber);
        }
        return wasClicked == level.getChecksOfMove().get(level.getChecksOfMove().size() - 1).getResult();
    }

    private void congratulation(float duration) {
        gameCircle.setColor(Color.GREEN);
        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }

    private void normalCircle() {
        gameCircle.setColor(Color.BLUE);
        //shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }

    private void disgrace(float duration) {
        gameCircle.setColor(Color.RED);
        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }

    public void back() {
        saveGame();
        Gdx.input.setInputProcessor(null);
        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_ELASTIC));

        gui.back();
        sides.back();
        gameCircle.back();
    }

    public void changePause() {
        if (pause) {
            pause = false;
            gui.changeImagePlayToPause();
            bottomPause.toDisappear();
            gameCircle.setVisiblePlay(pause);
        } else {
            pause = true;
            gui.changeImagePauseToPlay();
            bottomPause.toVisible();
            gameCircle.setVisiblePlay(pause);
        }
    }


}

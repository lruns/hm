package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.graphics.glutils.FrameBuffer;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.math.Matrix4;
import com.badlogic.gdx.scenes.scene2d.Action;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.MoveToAction;
import com.badlogic.gdx.scenes.scene2d.actions.ParallelAction;
import com.badlogic.gdx.scenes.scene2d.actions.RepeatAction;
import com.badlogic.gdx.scenes.scene2d.actions.RotateByAction;
import com.badlogic.gdx.scenes.scene2d.actions.RotateToAction;
import com.badlogic.gdx.scenes.scene2d.actions.ScaleToAction;
import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Container;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ProgressBar;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Pool;
import com.badlogic.gdx.utils.Scaling;
import com.badlogic.gdx.utils.Timer;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

import jdk.nashorn.internal.codegen.ClassEmitter;
import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.ChangeSpeedActor;
import ru.neyvan.hm.actors.Explose;
import ru.neyvan.hm.actors.GameCircle;
import ru.neyvan.hm.actors.LevelInfoBox;
import ru.neyvan.hm.actors.LifesBox;
import ru.neyvan.hm.actors.ScoreBox;
import ru.neyvan.hm.actors.Shine;
import ru.neyvan.hm.actors.StreamEnergy;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.MenuScreen;
import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.ScreenEffects;

/**
 * Created by AndyGo on 25.11.2017.
 */
public class GUI {
    private PlayScreen core;
    private Stage stage;
    private Skin skin;

    /***********************************
     *  Game Elements - appear, when you play game
     ***********************************/
    private Image background;

    //top
    private Group panel;
    private LifesBox lifesBox;
    private LevelInfoBox levelInfoBox;
    private ScoreBox scoreBox;
    private Table tableLeft;
    private Button btnPause;

    // middle
    private Image leftFrame;
    private Image rightFrame;
    private StreamEnergy streamEnergy;
    private GameCircle gameCircle;

    //bottom
    private ProgressBar bar;

    /***********************************
     *  Another element
     ***********************************/

    // Image with text for showing "Begin", "Win", "Lose" between circle display and top panel
    private Container<Label> showInfo;
    private Label showInfoLabel;
    // Window for start game and pause game
    private GamePause gamePause;

    private ChangeSpeedActor changeSpeedActor;
    private Explose explose;


    private ImageButton.ImageButtonStyle pauseStyle;
    private TextureRegionDrawable pauseClick, pause;
    private boolean isAppear = false;
    private boolean isScreenEffect = false;
    private int typeScreenEffect;

    private ShaderProgram colorMusicShader;
    private ShaderProgram inversionShader;
    private float timeColorMusicShader = 0;
    private FrameBuffer frameBuffer;


    public GUI(final PlayScreen core) {
        this.core = core;
        isAppear = false;
        stage = new Stage(new ExtendViewport(Constants.MIN_WIDTH, Constants.MIN_HEIGHT,
                Constants.MAX_WIDTH, Constants.MAX_HEIGHT));
        skin = HM.game.texture.skin;

        //****** GameElements ********//

        background = new Image();
        background.setAlign(Align.center);
        background.setFillParent(true);
        background.setScaling(Scaling.fill);


        // Top Scene

        lifesBox = new LifesBox(skin);
        scoreBox = new ScoreBox(  skin, "title");
        levelInfoBox = new LevelInfoBox(skin, "advira");
        levelInfoBox = new LevelInfoBox(skin, "advira");

        tableLeft = new Table();
        //tableLeft.setDebug(true);

        tableLeft.add(lifesBox);
        tableLeft.add(scoreBox).row();
        tableLeft.add(levelInfoBox).top().left();

        pause = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("pause"));
        pauseClick = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("pauseClick"));
        pauseStyle = new ImageButton.ImageButtonStyle();
        pauseStyle.up = pause;
        pauseStyle.over = pause;
        pauseStyle.down = pauseClick;

        btnPause = new ImageButton(pauseStyle);
        btnPause.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                core.gamePause();
            }
        });

        panel = new Group();
        panel.addActor(tableLeft); panel.addActor(btnPause);

        // Middle Scene

        streamEnergy = new StreamEnergy(0.3f);

        leftFrame = new Image();
        rightFrame = new Image();

        gameCircle = new GameCircle(core);

        // Bottom Scene

        ProgressBar.ProgressBarStyle barStyle = new ProgressBar.ProgressBarStyle(
                new TextureRegionDrawable(HM.game.texture.atlas.findRegion("progressBar")),
                new TextureRegionDrawable(HM.game.texture.atlas.findRegion("progressKnob")));
        barStyle.knobBefore = barStyle.knob;
        bar = new ProgressBar(0, 1, 0.001f, false, barStyle);
        bar.setAnimateDuration(0.1f);

        background.setVisible(false);
        background.setColor(1,1,1,0);
        streamEnergy.setVisible(false);
        panel.setVisible(false);
        leftFrame.setVisible(false);
        rightFrame.setVisible(false);
        gameCircle.setVisible(false);
        gameCircle.setColor(1,1,1,0);
        bar.setVisible(false);

        stage.addActor(background);
        stage.addActor(streamEnergy);
        stage.addActor(panel);
        stage.addActor(leftFrame);
        stage.addActor(rightFrame);
        stage.addActor(gameCircle);
        stage.addActor(bar);
        initSizeAndReposition();

        // ******* Another ***********//

        showInfoLabel = new Label(" ", skin, "big");
        showInfoLabel.setAlignment(Align.center);
        showInfo = new Container<Label>(showInfoLabel);
        showInfo.setTransform(true);
        stage.addActor(showInfo);
        changeSpeedActor = new ChangeSpeedActor(1.0f);
        stage.addActor(changeSpeedActor);
        explose = new Explose(1.0f);
        stage.addActor(explose);
        gamePause = new GamePause(core, skin, stage);
        colorMusicShader = HM.game.shader.getColorMusicShader();
        inversionShader = HM.game.shader.getInversionShader();
        frameBuffer = new FrameBuffer(Pixmap.Format.RGB888, Gdx.graphics.getWidth(), Gdx.graphics.getHeight(), false);

        //shine = new Shine();


    }

    private void initSizeAndReposition() {

        panel.setSize(stage.getWidth(), 0.135f*stage.getHeight());
        tableLeft.setSize(panel.getWidth()*0.8f, panel.getHeight());
        tableLeft.getCell(lifesBox).size(tableLeft.getWidth()*0.35f, tableLeft.getHeight()*0.4f).space(tableLeft.getHeight()*0.02f,tableLeft.getWidth()*0.01f,
                tableLeft.getHeight()*0.02f,tableLeft.getWidth()*0.15f);
        tableLeft.getCell(scoreBox).width(tableLeft.getWidth()*0.5f);
        tableLeft.getCell(levelInfoBox).size(tableLeft.getWidth()*0.3f, tableLeft.getHeight()*0.4f);
        btnPause.setSize(stage.getWidth()*0.167f, stage.getWidth()*0.1516f);

        leftFrame.setSize(stage.getWidth() * 0.415f, stage.getWidth() * 1.133f);
        rightFrame.setSize(leftFrame.getWidth(), leftFrame.getHeight());
        gameCircle.setSize(0.45f * stage.getWidth(), 0.45f*stage.getWidth());


        bar.setSize(0.58f * stage.getWidth(), 0.075f * stage.getWidth());


//            panel.setPosition(0, stage.getHeight() - panel.getHeight());
//            btnPause.setPosition(panel.getWidth() - btnPause.getWidth(), panel.getHeight()-btnPause.getHeight());
//            leftFrame.setPosition(stage.getWidth()*0.0625f, (stage.getHeight()-leftFrame.getHeight())/2);
//            rightFrame.setPosition(stage.getWidth()*0.53f, (stage.getHeight()-rightFrame.getHeight())/2);
//            bar.setPosition((stage.getWidth()-bar.getWidth())/2, stage.getHeight()*0.1f);
        panel.setPosition(0, stage.getHeight());
        btnPause.setPosition(panel.getWidth() - btnPause.getWidth(), panel.getHeight()-btnPause.getHeight());
        leftFrame.setPosition(-leftFrame.getWidth(), (stage.getHeight()-leftFrame.getHeight())/2);
        rightFrame.setPosition(stage.getWidth(), (stage.getHeight()-rightFrame.getHeight())/2);
        bar.setPosition((stage.getWidth()-bar.getWidth())/2, -bar.getHeight());
        gameCircle.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        gameCircle.setOrigin(Align.center);
        streamEnergy.setEffectPosition(stage.getWidth()/2, 0.05f * stage.getHeight(), gameCircle.getY()+gameCircle.getHeight());
    }


    public void update(float delta) {
        stage.act(delta);
    }

    public void render(float delta) {
        if(isScreenEffect){
            frameBuffer.begin();
            Gdx.gl.glClearColor(0, 0, 0, 1);
            Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
            stage.draw();
            frameBuffer.end();
            Texture texture = frameBuffer.getColorBufferTexture();
            TextureRegion textureRegion = new TextureRegion(texture);
            textureRegion.flip(false, true);

            stage.getBatch().begin();
            Gdx.gl.glClearColor(0, 0, 0, 1);
            Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
            if(typeScreenEffect == ScreenEffects.COLOR_MUSIC) {
                timeColorMusicShader += delta;
                colorMusicShader.begin();
                colorMusicShader.setUniformf("time", timeColorMusicShader);
                colorMusicShader.end();
                stage.getBatch().setShader(colorMusicShader);
            }else {
                stage.getBatch().setShader(inversionShader);
            }
            stage.getBatch().draw(textureRegion, 0, 0, stage.getViewport().getWorldWidth(), stage.getViewport().getWorldHeight());
            stage.getBatch().setShader(null);
            stage.getBatch().end();
        }else{
            Gdx.gl.glClearColor(0, 0, 0, 1);
            Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
            stage.draw();
        }
    }

    public void prepareLevel() {

        int i = Constants.EPISODE_APPEARANCE[core.getGame().getLevelNumber().getEpisode()];

        background.setDrawable(new TextureRegionDrawable(HM.game.texture.getGameBackground(core.getGame().getLevel().getI_background())));
        tableLeft.setBackground(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("leftUI"+i)));

        leftFrame.setDrawable(new TextureRegionDrawable((HM.game.texture.atlas.findRegion("sideFrameLeft"+i))));
        rightFrame.setDrawable(new TextureRegionDrawable((HM.game.texture.atlas.findRegion("sideFrameRight"+i))));

        gameCircle.setImages(i);

        updateLife();
        scoreBox.setBeginScore(core.getGame().getScore());
        updateLevelInfo();

    }

    public void updateGamePause(float delta) {
        background.act(delta);
        gamePause.act(delta);
    }

    public void updateLife(){
        lifesBox.setLifes(core.getGame().getLifes());
    }
    public void updateScore(){
        scoreBox.setScore(core.getGame().getScore());
    }
    public void updateLevelInfo(){
        levelInfoBox.setInfo(core.getGame().getLevelNumber());
    }
    // Where number and surprises will be displayed
    public void updateDisplay(){
        gameCircle.display(core.getGame().getSymbol());
        updateProgress();
    }
    public void updateDisplay(float animationTime){
        gameCircle.display(core.getGame().getSymbol(), animationTime);
        updateProgress();
    }
    // set empty in display for begin and ending game
    public void emptyDisplay() {
        gameCircle.display(null);
        updateProgress();
    }
    public void emptyDisplay(float animationTime) {
        gameCircle.display(null, animationTime);
        updateProgress();
    }
    public void fillTimeBar(float duration){
        gameCircle.fillBar(duration);
    }
    public void resetTimeBar(float duration){
        gameCircle.resetBar(duration);
    }

    public void updateProgress(){
        bar.setValue(core.getGame().getProgress());
    }



    public void appear(float time){
        if(isAppear) return;
        isAppear = true;
        background.setVisible(true);
        streamEnergy.setVisible(true);
        panel.setVisible(true);
        leftFrame.setVisible(true);
        rightFrame.setVisible(true);
        gameCircle.setVisible(true);
        bar.setVisible(true);

        background.addAction(Actions.fadeIn(time));

        panel.addAction(Actions.moveTo(0, stage.getHeight() - panel.getHeight(), time, Interpolation.pow2));

        leftFrame.addAction(Actions.moveTo(stage.getWidth()*0.0625f, (stage.getHeight()-leftFrame.getHeight())/2, time, Interpolation.circle));
        rightFrame.addAction(Actions.moveTo(stage.getWidth()*0.53f, (stage.getHeight()-rightFrame.getHeight())/2, time, Interpolation.circle));

        gameCircle.addAction(Actions.alpha(0));
        gameCircle.addAction(Actions.fadeIn(time));

        bar.addAction(Actions.moveTo((stage.getWidth()-bar.getWidth())/2, stage.getHeight()*0.1f, time, Interpolation.pow2));

        streamEnergy.addAction(Actions.sequence(Actions.delay(time*0.8f), Actions.run(new Runnable() {
            @Override
            public void run() {
                streamEnergy.start();
            }
        })));
        //
    }
    public void disappear(float time){
        if(!isAppear) return;
        isAppear = false;
        background.addAction(Actions.fadeOut(time));

        panel.addAction(Actions.moveTo(0, stage.getHeight(), time, Interpolation.pow2));

        leftFrame.addAction(Actions.moveTo(-leftFrame.getWidth(), (stage.getHeight()-leftFrame.getHeight())/2, time, Interpolation.circle));
        rightFrame.addAction(Actions.moveTo(stage.getWidth(), (stage.getHeight()-rightFrame.getHeight())/2, time, Interpolation.circle));

        gameCircle.addAction(Actions.fadeOut(time));

        bar.addAction(Actions.moveTo((stage.getWidth()-bar.getWidth())/2, -bar.getHeight(), time, Interpolation.pow2));

        streamEnergy.addAction(Actions.sequence(Actions.delay(time*0.8f), Actions.run(new Runnable() {
            @Override
            public void run() {
                streamEnergy.stop();
            }
        })));
        Timer.schedule(new Timer.Task() {
            @Override
            public void run() {
                background.setVisible(false);
                streamEnergy.setVisible(false);
                panel.setVisible(false);
                leftFrame.setVisible(false);
                rightFrame.setVisible(false);
                gameCircle.setVisible(false);
                bar.setVisible(false);
            }
        },time);
    }


    public void congratulation(float duration) {
        gameCircle.glowBar(duration, Color.GREEN);
//        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }


    public void disgrace(float duration) {
        gameCircle.glowBar(duration, Color.RED);
//        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }

    public void colorTimeBar(float duration, Color color) {
        gameCircle.glowBar(duration, color);
//        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, duration, true);
    }


    public void toGamePause() {
        gamePause.appear(0.5f);
        gameCircle.hideSymbol();
    }

    public void toResumeGame() {
        gamePause.disappear(0.5f);
        gameCircle.showSymbol();
    }

    public void showStart(final float time) {
        settingShowInfo(HM.game.bundle.get("startGame"), time);
    }
    public void showLose(float time) {
        settingShowInfo(HM.game.bundle.get("gameOver"), time);
    }
    public void showWin(float time) {
        settingShowInfo(HM.game.bundle.get("levelComplete"), time);
    }
    public void showEpisodeComplete(float time) {
        settingShowInfo(HM.game.bundle.get("allEpisodeComplete"), time);
    }
    public void showAllGameComplete(float time) {
        settingShowInfo(HM.game.bundle.get("allGameComplete"), time);
    }
    public void showHelp(float time, boolean checkClick) {
        if(checkClick) settingShowInfo(HM.game.bundle.get("click"), time, true);
        else  settingShowInfo(HM.game.bundle.get("noclick"), time, true);
    }

    private void settingShowInfo(String text, float time){
        this.settingShowInfo(text, time, false);
    }

    private void settingShowInfo(String text, float time, boolean fastAppear){

        showInfo.setScale(0);
        showInfo.getActor().setText(text);
        showInfo.setHeight(stage.getHeight() * 0.3f);
        showInfo.setWidth(showInfo.getHeight() / showInfo.getActor().getGlyphLayout().width *
                showInfo.getActor().getGlyphLayout().width);
        showInfo.setPosition(stage.getWidth() * 0.5f, stage.getHeight() * 0.7f, Align.center);
        showInfo.setOrigin(Align.center);

        if(fastAppear){
            SequenceAction appearAction = new SequenceAction();
            ParallelAction firstStep = new ParallelAction();
            firstStep.addAction(Actions.scaleTo(1, 1f, time*0.1f, Interpolation.circleOut));
            firstStep.addAction(Actions.fadeIn(time*0.1f, Interpolation.circleIn));
            appearAction.addAction(firstStep);

            ScaleToAction disappearAction = new ScaleToAction();
            disappearAction.setScale(0);
            disappearAction.setDuration(time * 0.5f);
            disappearAction.setInterpolation(Interpolation.circle);

            SequenceAction overallSequance = new SequenceAction();
            overallSequance.addAction(appearAction);
            overallSequance.addAction(Actions.delay(time*0.4f));
            overallSequance.addAction(disappearAction);

            showInfo.addAction(overallSequance);

        }else{
            SequenceAction appearAction = new SequenceAction();
            ParallelAction firstStep = new ParallelAction();
            firstStep.addAction(Actions.scaleTo(1, 0.25f, time*0.3f, Interpolation.circleOut));
            firstStep.addAction(Actions.fadeIn(time*0.3f, Interpolation.circleIn));

            appearAction.addAction(Actions.fadeOut(0));
            appearAction.addAction(firstStep);
            appearAction.addAction(Actions.scaleTo(1, 1f, time*0.2f, Interpolation.circleOut));


            ScaleToAction disappearAction = new ScaleToAction();
            disappearAction.setScale(0);
            disappearAction.setDuration(time * 0.5f);

            disappearAction.setInterpolation(Interpolation.circle);

            SequenceAction overallSequance = new SequenceAction();
            overallSequance.addAction(appearAction);
            overallSequance.addAction(disappearAction);

            showInfo.addAction(overallSequance);
        }

    }

    public void explose(Symbol symbol, float duration) {
        gameCircle.explose(symbol, duration);
        explose.setEffectPosition(gameCircle.getX()+gameCircle.getWidth()/2, gameCircle.getY()+gameCircle.getHeight()/2);
        explose.start();
    }
    public void explose(float duration) {
        explose.setEffectPosition(gameCircle.getX()+gameCircle.getWidth()/2, gameCircle.getY()+gameCircle.getHeight()/2);
        explose.start();
    }

    public void hideChance() {
    }

    public void giveChance() {

    }


    public void resize(int width, int height) {
        stage.getViewport().update(width, height, true);

        frameBuffer.dispose();
        frameBuffer = new FrameBuffer(Pixmap.Format.RGB888, stage.getViewport().getScreenWidth(), stage.getViewport().getScreenHeight(), false);

        //Please change this bad realization of resize and reposition!!!
        gameCircle.updateSizePosition();
    }


    public void dispose() {
        gamePause.dispose();
        streamEnergy.dispose();
        changeSpeedActor.dispose();
        gameCircle.dispose();
        frameBuffer.dispose();
    }

    public Stage getStage() {
        return stage;
    }


    public void resetGamePause() {
        gamePause.setBeginGame();
    }

    private Action rotateAction;
    public void startRotate(float speed, boolean oneCircle, float time) {
        if(oneCircle) {
            gameCircle.addAction(Actions.rotateBy(360, time));
        }else{
            float duration = 90/Math.abs(speed);

            rotateAction = new RepeatAction();
            ((RepeatAction) rotateAction).setCount(RepeatAction.FOREVER);
            ((RepeatAction) rotateAction).setAction(Actions.rotateBy(Math.signum(speed)*90, duration));
            gameCircle.addAction(rotateAction);

        }
    }

    public void stopRotate() {
        gameCircle.removeAction(rotateAction);
        gameCircle.addAction(Actions.rotateTo(0, 0.5f));
    }

    private RepeatAction transferenceAction;
    public void startTransference(float speedX, float speedY) {
        gameCircle.addAction(Actions.moveTo((stage.getWidth()-gameCircle.getWidth())/2,
                (stage.getHeight()-gameCircle.getHeight())/2));

        SequenceAction transferenceX = new SequenceAction();
        float durationX = 0.5f/Math.abs(speedX);

        transferenceX.addAction(Actions.moveBy(Math.signum(speedX) * (stage.getWidth()/2 - gameCircle.getWidth()/2), 0, durationX));
        transferenceX.addAction(Actions.moveBy(-Math.signum(speedX)*(stage.getWidth() - gameCircle.getWidth()), 0, 2*durationX));
        transferenceX.addAction(Actions.moveBy(Math.signum(speedX) * stage.getWidth()/2 - gameCircle.getWidth()/2, 0, durationX));

        SequenceAction transferenceY = new SequenceAction();
        float durationY = 0.5f/Math.abs(speedY);
        transferenceY.addAction(Actions.moveBy(0, Math.signum(speedY) * (stage.getHeight()/2 - gameCircle.getHeight()/2), durationY));
        transferenceX.addAction(Actions.moveBy(0, -Math.signum(speedY) * (stage.getHeight() - gameCircle.getHeight()), 2*durationY));
        transferenceX.addAction(Actions.moveBy(0, Math.signum(speedY) * (stage.getHeight()/2 - gameCircle.getHeight()/2), durationY));

        ParallelAction allActions = new ParallelAction();
        allActions.addAction(transferenceX);
        allActions.addAction(transferenceY);

        transferenceAction = new RepeatAction();
        transferenceAction.setCount(RepeatAction.FOREVER);
        transferenceAction.setAction(allActions);

        gameCircle.addAction(transferenceAction);
    }

    public void stopTransference() {
        gameCircle.removeAction(transferenceAction);
        gameCircle.addAction(Actions.moveTo((stage.getWidth()-gameCircle.getWidth())/2,
                (stage.getHeight()-gameCircle.getHeight())/2, 0.5f));
    }


    private RepeatAction warpAction;
    public void startWarp(float speedWarp) {
        SequenceAction sequenceAction = new SequenceAction();
        float duration = 1/Math.abs(speedWarp);
        sequenceAction.addAction(Actions.scaleTo(1.25f, 0.75f, duration));
        sequenceAction.addAction(Actions.scaleTo(0.75f, 1.25f, duration));

        warpAction = new RepeatAction();
        warpAction.setCount(RepeatAction.FOREVER);
        warpAction.setAction(sequenceAction);
        gameCircle.addAction(warpAction);
    }

    public void stopWarp() {
        gameCircle.removeAction(warpAction);
        gameCircle.addAction(Actions.scaleTo(1, 1, 0.5f));
    }


    public void changeSpeedTime(boolean isSpeedUp, float effectSpeed) {
        changeSpeedActor.setEffectPosition(0, stage.getHeight());
        changeSpeedActor.start(isSpeedUp);
        changeSpeedActor.setSpeed(effectSpeed);
    }

    public void resetSpeedTime() {
        changeSpeedActor.stop();
    }

    public void startScreenEffect(int type) {
        isScreenEffect = true;
        typeScreenEffect = type;
    }

    public void stopScreenEffect() {
        isScreenEffect = false;
    }

    public void setLevelDescription(String text) {
        gamePause.setLevelDescription(text);
    }
}

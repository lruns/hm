package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.ui.ProgressBar;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Scaling;
import com.badlogic.gdx.utils.Timer;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.GameCircle;
import ru.neyvan.hm.actors.LevelInfoBox;
import ru.neyvan.hm.actors.LifesBox;
import ru.neyvan.hm.actors.ScoreBox;
import ru.neyvan.hm.actors.Shine;
import ru.neyvan.hm.actors.StreamEnergy;
import ru.neyvan.hm.screens.MenuScreen;
import ru.neyvan.hm.screens.PlayScreen;

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

    private GamePause gamePause;

    private ImageButton.ImageButtonStyle pauseStyle;
    private TextureRegionDrawable pauseClick, pause;
    private boolean isAppear = false; // not used

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
        levelInfoBox = new LevelInfoBox(skin, "kurale");

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

        gamePause = new GamePause(core, skin, stage);
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
        streamEnergy.setEffectPosition(stage.getWidth()/2, 0.05f * stage.getHeight(), gameCircle.getY()+gameCircle.getHeight());
    }


    public void update(float delta) {
        stage.act(delta);
    }

    public void render(float delta) {
        Gdx.gl.glClearColor(0, 0, 0, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        stage.draw();
    }

    public void prepareLevel() {

        int i = Constants.EPISODE_APPEARANCE[core.getGame().getLevelNumber().getEpisode()];

        background.setDrawable(new TextureRegionDrawable(HM.game.texture.getGameBackground(core.getGame().getLevel().getI_background())));
        tableLeft.setBackground(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("leftUI"+i)));

        leftFrame.setDrawable(new TextureRegionDrawable((HM.game.texture.atlas.findRegion("sideFrameLeft"+i))));
        rightFrame.setDrawable(new TextureRegionDrawable((HM.game.texture.atlas.findRegion("sideFrameRight"+i))));

        gameCircle.setImages(i);

        updateLife();
        updateScore();
        updateLevelInfo();

    }

    public void updateGamePause(float delta) {
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


    public void toGamePause() {
        gamePause.appear(0.5f);
        gameCircle.hideSymbol();
    }

    public void toResumeGame() {
        gamePause.disappear(0.5f);
        gameCircle.showSymbol();
    }

    public void resize(int width, int height) {
        stage.getViewport().update(width, height, true);

        //Please change this bad realization of resize and reposition!!!
        gameCircle.updateSizePosition();
    }





    public void loseGame() {
    }

    public void jumpToPortal() {
    }

    public void jumpOutOfPortal() {
    }

    public boolean inPortal() {
        return true;
    }


    public void showWin() {
    }

    public void explose() {
    }

    public void hideChance() {
    }

    public void giveChance() {
    }


    public void dispose() {
//        gamePause.dispose();
    }

    public Stage getStage() {
        return stage;
    }


    public void showStart(float time) {
        // show start label -- Ready? ... Go!
    }
}

package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ProgressBar;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.viewport.FitViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.LifesBox;
import ru.neyvan.hm.screens.PlayScreen;

/**
 * Created by AndyGo on 25.11.2017.
 */
public class GUI {
    private PlayScreen parent;
    private Group panel;
    private LifesBox lifesBox;
    private Label labLevel;
    private Label labScore;
    private Table tableLeft;
    private Button btnPause;
    private ProgressBar bar;
    private Stage stage;
    private Skin skin;
    private float time;

    private ImageButton.ImageButtonStyle pauseStyle;
    private TextureRegionDrawable playMin, playClickMin, pauseClick, pause;

    private int referenceScore;
    private int nowScore;

    public GUI(final PlayScreen parent, float time){
        this.parent = parent;
        this.stage = parent.getStage();
        this.skin = parent.getSkin();
        this.time = time;
        tableLeft = new Table();
        tableLeft.setSize(0.8f*stage.getWidth(), 0.135f*stage.getHeight());
        tableLeft.setPosition(0, stage.getHeight()-tableLeft.getHeight());
        tableLeft.setBackground(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("leftUI")));
        lifesBox = new LifesBox(5, skin);
        labLevel = new Label("Level "+parent.getLevel().getEpisode()+"."+parent.getLevel().getCount_level(), skin, "kurale");
        labScore = new Label("523512", skin, "title");
        //tableLeft.setDebug(true);
        tableLeft.add(lifesBox).size(tableLeft.getWidth()*0.35f, tableLeft.getHeight()*0.4f)
                .space(tableLeft.getHeight()*0.02f,tableLeft.getWidth()*0.01f,
                        tableLeft.getHeight()*0.02f,tableLeft.getWidth()*0.15f);
        tableLeft.add(labScore).width(tableLeft.getWidth()*0.5f).row();
        tableLeft.add(labLevel).size(tableLeft.getWidth()*0.3f, tableLeft.getHeight()*0.4f).top().left();

        pause = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("pause"));
        pauseClick = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("pauseClick"));
        playClickMin = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playClickMin"));
        playMin = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playMin"));

        pauseStyle = new ImageButton.ImageButtonStyle();
        pauseStyle.up = pause;//кнопка не нажата
        pauseStyle.over = pause;
        pauseStyle.down = pauseClick; // кнопка нажата

        btnPause = new ImageButton(pauseStyle);
        btnPause.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                parent.changePause();
            }
        });
        btnPause.setSize(stage.getWidth()*0.167f, stage.getHeight()*0.091f);
        btnPause.setPosition(stage.getWidth()-btnPause.getWidth(), stage.getHeight()-btnPause.getHeight());

        panel = new Group();
        panel.setSize(stage.getWidth(), tableLeft.getHeight());
        panel.addActor(tableLeft); panel.addActor(btnPause);
        panel.setPosition(0, stage.getHeight());
        stage.addActor(panel);
        //btnPause.setBackground());
    }
    public void start() {
        panel.addAction(Actions.moveTo(0, 0, time, Interpolation.pow2));
    }
    public void back() {
        panel.addAction(Actions.moveTo(0, stage.getHeight(), time, Interpolation.pow2));
    }
    public void update(float delta){
        if(nowScore != referenceScore){
            if(nowScore < referenceScore) nowScore++;
            else nowScore--;
            labScore.setText(Integer.toString(nowScore));
        }
    }

    public void setLifes(int lifes) {
        lifesBox.setLifes(lifes);
    }
    public void setBeginScore(int beginScore) {
        nowScore = beginScore;
        referenceScore = beginScore;
    }
    public void setNewScore(int score) {
        referenceScore = score;
    }

    public void changeImagePauseToPlay() {
        pauseStyle.up = playMin;//кнопка не нажата
        pauseStyle.over = playMin;
        pauseStyle.down = playClickMin; // кнопка нажата
    }

    public void changeImagePlayToPause() {
        pauseStyle.up = pause;//кнопка не нажата
        pauseStyle.over = pause;
        pauseStyle.down = pauseClick; // кнопка нажата
    }
}

package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.ButtonsEpisodeTable;
import ru.neyvan.hm.actors.EpisodesTable;
import ru.neyvan.hm.levels.LevelNumber;

/**
 * Created by AndyGo on 10.07.2017.
 */

public class EpisodesScreen extends ScreenAdapter {

    private Stage stage;
    private Skin skin;
    private Table mainTable;
    private Label title;
    private EpisodesTable scrollTable;
    private ButtonsEpisodeTable buttonsTable;
    private ScrollPane scrollPane;
    private LevelNumber clickedEpisode;

    public EpisodesScreen() {
        stage = new Stage(new ExtendViewport(Constants.MIN_WIDTH, Constants.MIN_HEIGHT,
                Constants.MAX_WIDTH, Constants.MAX_HEIGHT));
        skin = HM.game.texture.skin;
        HM.game.texture.setEpisodesImages();

        mainTable = new Table();
        mainTable.setFillParent(true);

        Label.LabelStyle titleStyle = new Label.LabelStyle();
        titleStyle.background = HM.game.texture.getNinePatchDrawable("frame");
        titleStyle.font = skin.getFont("title32");
        titleStyle.fontColor = Color.WHITE;
        title = new Label(HM.game.bundle.get("chooseEpisode"), titleStyle);
        title.setAlignment(Align.center);

        scrollTable = new EpisodesTable(skin, this);
        scrollPane = new ScrollPane(scrollTable);
        scrollPane.setScrollingDisabled(true, false);
        scrollPane.scrollTo(0,0,0,scrollPane.getScrollHeight());

        buttonsTable = new ButtonsEpisodeTable(skin, this);
        buttonsTable.setBackground(HM.game.texture.getNinePatchDrawable("frame"));

        mainTable.add(title).expand().fillX().top().row();
        mainTable.add(scrollPane).expand().row();
        mainTable.add(buttonsTable).expand().fillX().bottom().row();
        mainTable.setPosition(0, stage.getHeight());
        //mainTable.setDebug(true);

        stage.addActor(mainTable);
    }

    @Override
    public void show() {
        float time = 1f;
        mainTable.addAction(Actions.moveTo(0, 0, time, Interpolation.pow2));
        InputProcessor backProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.ESCAPE) || (keycode == Input.Keys.BACK)) backToMenu();
                return false;
            }
        };
        InputMultiplexer multiplexer = new InputMultiplexer(stage, backProcessor);
        Gdx.input.setInputProcessor(multiplexer);
    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClearColor(0, 0, 0, 0);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        stage.act(delta);
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        stage.getViewport().update(width, height, false);
    }

    @Override
    public void dispose() {
        stage.dispose();
        HM.game.texture.disposeEpisodesImages();
    }

    public void backToMenu() {
        Gdx.input.setInputProcessor(null);
        float time = 1.0f;
        mainTable.addAction(Actions.moveTo(0, stage.getHeight(), time, Interpolation.pow2));
        mainTable.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_FROM_BOTTOM));
                    }
                })
        ));
        stage.addAction(Actions.fadeOut(time));
    }

    public void changeEpisodeField() {
        buttonsTable.updateInfo();
    }

    public void startEpisode() {
        if(clickedEpisode == null) clickedEpisode = new LevelNumber(1,1);
        mainTable.addAction(Actions.sequence(
                Actions.fadeOut(1f),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        LevelNumber levelNumber = new LevelNumber(clickedEpisode.getEpisode(), 1);
                        HM.game.setScreen(new PlayScreen(levelNumber));
                    }
                })
        ));
    }

    public LevelNumber getClickedEpisode() {
        return clickedEpisode;
    }
    public void setClickedEpisode(LevelNumber clickedEpisode){
        this.clickedEpisode = clickedEpisode;
    }
}

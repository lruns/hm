package ru.neyvan.hm.game;

import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Value;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;
import com.badlogic.gdx.utils.Scaling;
import com.badlogic.gdx.utils.Timer;

import ru.neyvan.hm.actors.WindowExit;
import ru.neyvan.hm.screens.PlayScreen;

public class GamePause {
    private Label title, infoMain, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnExit;
    private TextButton btnPlay;
    private String infoText =
            "Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles." + "Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles.";
    private PlayScreen playScreen;
    private Stage stage;
    private Image darkBackground;
    private Texture texture;
    private Skin skin;

    public GamePause(PlayScreen playScreen, Skin skin, Stage stage) {
        this.playScreen = playScreen;
        this.stage = stage;
        this.skin = skin;

        Pixmap pixmap = new Pixmap(1, 1, Pixmap.Format.RGBA8888);
        pixmap.setColor(0, 0, 0, 0.7f);
        pixmap.fillRectangle(0,0,1,1);
        texture = new Texture(pixmap);
        pixmap.dispose();

        darkBackground = new Image();
        darkBackground.setColor(0,0,0,0);
        darkBackground.setDrawable(new TextureRegionDrawable(texture));
        darkBackground.setSize(stage.getWidth(), stage.getHeight());
        darkBackground.setPosition(0, 0);
        darkBackground.setScaling(Scaling.fill);
        stage.addActor(darkBackground);

        table = new Table(skin);
        table.setBackground("Window"); //table.debug();
        table.setSize(stage.getWidth() * 1f, stage.getWidth() *1.667f);
        table.setPosition((stage.getWidth() - table.getWidth()) / 2, (stage.getHeight() - table.getHeight()) / 2);
        table.pad(table.getHeight() * 0.02f, table.getWidth() * 0.2f, 0, table.getWidth() * 0.2f);

        title = new Label("Pause", skin, "title");
        title.setAlignment(Align.center);

        infoMain = new Label("Start level", skin);

        infoScroll = new Label(infoText, skin);
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.55f);
        scroller = new ScrollPane(scrollTable, skin);
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);

        btnExit = new TextButton("Exit", skin);
        btnExit.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                exit();
            }
        });

        btnPlay = new TextButton("Play", skin);
        btnPlay.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                play();
            }
        });


        table.add(title).padBottom(table.getHeight() * 0.01f).align(Align.top).row();
        table.add(infoMain).height(infoMain.getHeight()).width(table.getWidth() * 0.6f).row();
        table.add(scroller).height(table.getHeight() * 0.6f - infoMain.getHeight()).width(table.getWidth() * 0.6f).row();
        table.add(btnPlay).width(table.getWidth() * 0.5f).row();
        table.add(btnExit).width(table.getWidth() * 0.35f).row();

        table.setColor(1,1,1,0);

        stage.addActor(table);
    }

    public void exit() {
        WindowExit windowExit = new WindowExit("Quit Game", skin, "octagon", stage, playScreen);
        windowExit.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowExit);
    }

    public void play() {
        playScreen.resumeGame();
    }


    public void appear(float time) {
        table.setVisible(true);
        darkBackground.setVisible(true);
        darkBackground.addAction(Actions.fadeIn(time));
        table.addAction(Actions.fadeIn(time));
    }

    public void disappear(float time) {
        darkBackground.setColor(1,1,1,0);
        table.setColor(1,1,1,0);
        darkBackground.setVisible(false);
        table.setVisible(false);

    }

    public void dispose() {
        texture.dispose();
    }

    public void act(float delta) {
        darkBackground.act(delta);
        table.act(delta);
    }
}

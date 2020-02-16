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
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.screens.PlayScreen;

public class GamePause {
    private Label title, infoMain, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnBack;
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

    public GamePause(PlayScreen playScreen, Skin skin, Stage stage) {
        this.playScreen = playScreen;
        this.stage = stage;

        Pixmap pixmap = new Pixmap(2, 2, Pixmap.Format.RGBA8888);
        pixmap.setColor(0, 0, 0, 0.5f);
        pixmap.fillRectangle(0, 0, 2, 2);
        texture = new Texture(pixmap);
        pixmap.dispose();

        darkBackground = new Image();
        darkBackground.setDrawable(new TextureRegionDrawable(texture));
        darkBackground.setSize(stage.getWidth(), stage.getHeight());
        darkBackground.setPosition(0, 0);
        stage.addActor(darkBackground);

        table = new Table(skin);
        table.setBackground("Window"); //table.debug();
        table.setSize(stage.getWidth() * 1f, stage.getWidth() * 0.75f);
        table.setPosition((stage.getWidth() - table.getWidth()) / 2, -table.getHeight());
        table.pad(table.getHeight() * 0.02f, table.getWidth() * 0.2f, 0, table.getWidth() * 0.2f);

        title = new Label("Info", skin, "title");
        title.setAlignment(Align.center);

        infoMain = new Label("Website: www.elsohome.ru \n" + "Version: 1.0.0", skin);

        infoScroll = new Label(infoText, skin);
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.55f);
        scroller = new ScrollPane(scrollTable, skin);
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);

        btnBack = new TextButton("Back", skin);
        btnBack.addListener(new ChangeListener() {
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


        table.add(title).padBottom(table.getHeight() * 0.05f).expand().row();
        table.add(infoMain).height(infoMain.getHeight()).width(table.getWidth() * 0.6f).row();
        table.add(scroller).height(table.getHeight() * 0.7f - infoMain.getHeight()).width(table.getWidth() * 0.6f).row();
        table.add(btnBack).expand();
        table.add(btnPlay).expand();

        stage.addActor(table);


    }

    public void exit() {
        playScreen.exit();
    }

    public void play() {
        playScreen.resumeGame();
    }


    public void appear(float time) {
        table.setVisible(true);
        darkBackground.addAction(Actions.fadeIn(time));
        table.addAction(Actions.moveTo((stage.getWidth() - table.getWidth()) / 2, (stage.getHeight() - table.getHeight()) / 2, time, Interpolation.pow3Out));
    }

    public void disappear(float time) {
        darkBackground.addAction(Actions.fadeOut(time));
        table.addAction(Actions.moveTo((stage.getWidth() - table.getWidth()) / 2, -table.getHeight(), time, Interpolation.circleIn));
    }

    public void dispose() {
        texture.dispose();
    }

    public void act(float delta) {
        table.act(delta);
    }
}

package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.MenuScreen;
import ru.neyvan.hm.screens.PlayScreen;

import static ru.neyvan.hm.screens.ScreenMenuModel.posX;
import static ru.neyvan.hm.screens.ScreenMenuModel.posY;

public class GamePreload {
    private Label title, infoMain, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnBack;
    private float time;
    private String infoText =
            "Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles."+"Towards to space adventures! Go through the obstacles on a space plate!\n" +
                    "The game “Flappy Space” is an arcade in the space style, where you should try to overcome as many " +
                    "obstacles as possible on the space plate. The shields of the ship have three charges capable of protecting" +
                    " the ship from impacts with obstacles.";

    private PlayScreen playScreen;
    private Stage stage;

    public GamePreload(final Skin skin, final Stage stage, final PlayScreen playScreen) {
        this.stage = stage;
        this.playScreen = playScreen;
        table = new Table(skin);
        table.setBackground("Window"); //table.debug();
        table.setSize(stage.getWidth()*1f, stage.getHeight()*0.8f);
        table.setPosition(posX(stage, table, 0.5f), -table.getHeight());
        table.pad(table.getHeight()*0.02f, table.getWidth()*0.2f, 0, table.getWidth()*0.2f);

        title = new Label("Info", skin, "title");
        title.setAlignment(Align.center);

        infoMain = new Label("Website: www.elsohome.ru \n"+ "Version: 1.0.0", skin);

        infoScroll = new Label(infoText, skin);
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.55f);
        scroller = new ScrollPane(scrollTable, skin);
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);

        btnBack = new TextButton("Play", skin);
        btnBack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                play();
            }
        });


        table.add(title).padBottom(table.getHeight()*0.05f).expand().row();
        table.add(infoMain).height(infoMain.getHeight()).width(table.getWidth()*0.6f).row();
        table.add(scroller).height(table.getHeight()*0.7f-infoMain.getHeight()).width(table.getWidth()*0.6f).row();
        table.add(btnBack).expand();
        stage.addActor(table);
    }

    public void appear() {
        table.addAction(Actions.moveTo(posX(stage, table, 0.5f), posY(stage, table, 0.5f), time, Interpolation.pow3Out));
    }
    private void play() {
        playScreen.setPlayStart(true);
        table.addAction(Actions.moveTo(posX(stage, table, 0.5f), -table.getHeight(), time, Interpolation.circleIn));

    }
}

package ru.neyvan.hm.game;

import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
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
import com.badlogic.gdx.utils.Scaling;
import com.badlogic.gdx.utils.Timer;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.WindowExit;
import ru.neyvan.hm.screens.PlayScreen;

public class GamePause {
    private Label title, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnExit;
    private TextButton btnPlay;
    private String infoText;
    private PlayScreen playScreen;
    private Stage stage;
    private Image darkBackground;
    private Texture texture;
    private Skin skin;

    private boolean isBeginGame;

    public GamePause(PlayScreen playScreen, Skin skin, Stage stage) {
        this.playScreen = playScreen;
        this.stage = stage;
        this.skin = skin;
        isBeginGame = true;

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

        title = new Label(HM.game.bundle.get("pause"), skin, "title");
        title.setAlignment(Align.center);

        infoScroll = new Label(infoText, skin);
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.55f);
        scroller = new ScrollPane(scrollTable, skin);
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);

        btnExit = new TextButton(HM.game.bundle.get("exit"), skin);
        btnExit.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                exit();
            }
        });

        btnPlay = new TextButton(HM.game.bundle.get("play"), skin);
        btnPlay.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                play();
            }
        });


        table.align(Align.top);
        table.add(title).padTop(table.getHeight() * 0.03f).padBottom(table.getHeight() * 0.06f).align(Align.top).row();
        table.add(scroller).height(table.getHeight() * 0.6f).width(table.getWidth() * 0.6f).row();
        table.add(btnPlay).width(table.getWidth() * 0.5f).row();
        table.add(btnExit).width(table.getWidth() * 0.35f).row();

        table.setColor(1,1,1,0);
        table.setDebug(false);

        stage.addActor(table);
        setBeginGame();
    }

    public void exit() {
        WindowExit windowExit = new WindowExit(HM.game.bundle.get("quitGame"), skin, "octagon", stage, playScreen);
        windowExit.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowExit);
    }

    public void play() {
        playScreen.resumeGame();
    }

    public void setLevelDescription(String text){
        infoScroll.setText(text);
    }

    public void setBeginGame(){
        isBeginGame = true;
        title.setText(HM.game.bundle.get("begin"));
        btnPlay.setText(HM.game.bundle.get("play"));
        btnExit.setVisible(false);
        table.getCell(scroller).height((table.getHeight() * 0.68f));
    }

    public void setNormalGame(){
        isBeginGame = false;
        title.setText(HM.game.bundle.get("pause"));
        btnPlay.setText(HM.game.bundle.get("continue"));
        btnExit.setVisible(true);
        table.getCell(scroller).height((table.getHeight() * 0.6f));
    }

    public void appear(float time) {
        if(isBeginGame){
            darkBackground.setVisible(false);
        }else{
            darkBackground.setVisible(true);
            darkBackground.addAction(Actions.fadeIn(time));
        }
        table.setVisible(true);
        table.addAction(Actions.fadeIn(time));
    }

    public void disappear(float time) {
        if(isBeginGame){
            table.addAction(Actions.fadeOut(time));
            Timer.schedule(new Timer.Task() {
                @Override
                public void run() {
                    table.setVisible(false);
                    setNormalGame();
                }
            },time);
        }else{
            table.setColor(1,1,1,0);
            table.setVisible(false);
        }

        darkBackground.setColor(1,1,1,0);
        darkBackground.setVisible(false);
    }

    public void dispose() {
        texture.dispose();
    }

    public void act(float delta) {
        darkBackground.act(delta);
        table.act(delta);
    }
}

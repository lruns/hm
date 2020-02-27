package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;

import static ru.neyvan.hm.Constants.EMAIL;
import static ru.neyvan.hm.Constants.VERSION;
import static ru.neyvan.hm.Constants.WEBSITE;

/**
 * Created by AndyGo on 13.10.2017.
 */

public class InfoMenu extends ScreenMenuModel {
    private Label title, infoScroll;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnBack;
    private StringBuilder infoText;
    private float time;

    public InfoMenu() {
        super();
        table = new Table(skin);
        table.setBackground("Window"); //table.debug();
        table.setSize(stage.getWidth()*1f, stage.getWidth()*1.667f);
        table.setPosition(posX(table, 0.5f), -table.getHeight());
        table.pad(table.getHeight()*0.02f, table.getWidth()*0.2f, 0, table.getWidth()*0.2f);

        title = new Label(HM.game.bundle.get("infoTitle"), skin, "title");
        title.setAlignment(Align.center);

        StringBuilder infoText = new StringBuilder();
        infoText.append(HM.game.bundle.format("versionInfo", VERSION));
        infoText.append("\n\n");
        infoText.append(HM.game.bundle.get("intro"));
        infoText.append("\n\n");
        infoText.append(HM.game.bundle.get("intro2"));
        infoText.append("\n\n");
        infoText.append(HM.game.bundle.get("howToPlay"));
        infoText.append("\n\n");
        infoText.append(HM.game.bundle.get("howToPlay2"));
        infoText.append("\n\n");
        infoText.append(HM.game.bundle.format("infoAbout", WEBSITE, EMAIL));
        infoText.append("\n\n");

        infoScroll = new Label(infoText.toString(), skin);
        infoScroll.setWrap(true);

        scrollTable = new Table();
        scrollTable.add(infoScroll).width(table.getWidth() * 0.55f);
        scroller = new ScrollPane(scrollTable, skin);
        scroller.setScrollingDisabled(true, false);
        scroller.setFadeScrollBars(false);
        //scroller.setFlickScroll(false);

        btnBack = new TextButton(HM.game.bundle.get("back"), skin);
        btnBack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end();
            }
        });


        table.add(title).padBottom(table.getHeight()*0.05f).expand().row();
        table.add(scroller).height(table.getHeight()*0.7f).width(table.getWidth()*0.6f).row();
        table.add(btnBack).expand();
        stage.addActor(table);



    }
    public void end(){
        Gdx.input.setInputProcessor(null);
        time = 0.5f;
        table.addAction(Actions.moveTo(posX(table, 0.5f), -table.getHeight(), time, Interpolation.circleIn));
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_FROM_TOP));
                    }
                })
        ));
    }
    @Override
    public void show(){
        super.show();
        time = 0.5f;
        table.addAction(Actions.moveTo(posX(table, 0.5f), posY(table, 0.5f), time, Interpolation.pow3Out));
    }
    @Override
    public void render(float delta) {
        super.render(delta);
    }

    @Override
    public void back() {
        super.back(); end();
    }
}




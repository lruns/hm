package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Container;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.ScrollPane;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Value;
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
    private Container container;
    private Table table;
    private Table scrollTable;
    private ScrollPane scroller;
    private TextButton btnBack;
    private StringBuilder infoText;
    private float time;

    public InfoMenu() {
        super();

        container = new Container();
        container.setFillParent(true);

        table = new Table(skin);
        table.setBackground("Window");
        table.setDebug(false);

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
        scrollTable.add(infoScroll).width(Value.percentWidth(0.55f, table));
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

        table.add(title).padBottom(Value.percentHeight(0.05f, table)).expand().row();
        table.add(scroller).height(Value.percentHeight(0.7f, table))
                .width(Value.percentWidth(0.6f, table)).row();
        table.add(btnBack).expand();

        container.setActor(table);
        stage.addActor(container);



    }
    public void end(){
        Gdx.input.setInputProcessor(null);
        time = 0.5f;
        container.addAction(Actions.moveTo(0, -stage.getHeight(), time, Interpolation.circleIn));
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(() -> HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_FROM_TOP)))
        ));
    }
    @Override
    public void show(){
        super.show();
        time = 0.5f;
        container.addAction(move(
                0, -stage.getHeight(),
                time, true, Interpolation.pow3Out
        ));
    }

    @Override
    public void back() {
        super.back(); end();
    }

    @Override
    public void resize(int width, int height) {
        super.resize(width, height);
        table.setSize(stage.getWidth()*1f, stage.getWidth()*1.667f);
        table.pad(table.getHeight()*0.02f, table.getWidth()*0.2f, 0, table.getWidth()*0.2f);
    }
}




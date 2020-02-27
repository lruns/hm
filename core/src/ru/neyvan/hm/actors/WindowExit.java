package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.ImageTextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.PlayScreen;

/**
 * Created by AndyGo on 05.11.2017.
 */

public class WindowExit extends Window {

    Label info;
    ImageTextButton btnOk;
    ImageTextButton btnCancel;

    public WindowExit(String title, final Skin skin, String styleName, final Stage stage){
        this(title, skin, styleName, stage, null);
    }

    public WindowExit(String title, final Skin skin, String styleName, final Stage stage, final PlayScreen core) {
        super(title, skin, styleName);
        getTitleLabel().setAlignment(Align.center);
        setModal(true);

        info = new Label(HM.game.bundle.get("exitQuestion"), skin, "advira");
        info.setWrap(true);

        btnOk = new ImageTextButton(HM.game.bundle.get("yes"), skin, "ok");
        btnOk.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(core != null) core.exit();
                else Gdx.app.exit();
                remove();
            }
        });
        btnCancel = new ImageTextButton(HM.game.bundle.get("no"), skin, "cancel");
        btnCancel.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                remove();
            }
        });
        pad(64,30,30,30);
        add(info).prefWidth(stage.getWidth()*0.5f).pad(10).colspan(2).row();
        add(btnOk);
        add(btnCancel);
        pack();
    }

}
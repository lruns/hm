package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 29.10.2017.
 */

public class WindowErrorName extends Window{
    Label info;
    TextButton btnOk;

    public WindowErrorName(String title, Skin skin,  boolean isRename, float prefWidth) {
        super(title, skin, "octagon");
        getTitleLabel().setAlignment(Align.center);
        setModal(true);

        info = new Label(isRename ? HM.game.bundle.get("errorInfoForRename") :
                HM.game.bundle.get("errorInfoForNewUser") , skin, "advira");
        info.setWrap(true);

        btnOk = new TextButton(HM.game.bundle.get("ok"), skin);
        btnOk.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                remove();
            }
        });
        pad(64,30,30,30);
        add(info).prefWidth(prefWidth).row();
        add(btnOk).row();
        pack();

    }
}
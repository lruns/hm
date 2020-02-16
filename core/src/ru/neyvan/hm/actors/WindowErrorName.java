package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

/**
 * Created by AndyGo on 29.10.2017.
 */

public class WindowErrorName extends Window{
    Label info;
    TextButton btnOk;
    String infoForRename = "Empty field! Enter your correct name. For example, John.";
    String infoForNewUser = "Empty field! Enter your name to create a new user profile for storing high score data and games in progress.";

    public WindowErrorName(String title, Skin skin,  boolean isRename, float prefWidth) {
        super(title, skin, "octagon");
        getTitleLabel().setAlignment(Align.center);
        setModal(true);

        info = new Label(isRename ? infoForRename : infoForNewUser, skin, "advira");
        info.setWrap(true);

        btnOk = new TextButton("Ok", skin);
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
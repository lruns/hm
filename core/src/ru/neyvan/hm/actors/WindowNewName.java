package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.ImageTextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.TextField;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.MenuScreen;

/**
 * Created by AndyGo on 02.11.2017.
 */

public class WindowNewName extends Window{

    Label info;
    TextField textField;
    ImageTextButton btnOk;

    public WindowNewName(String title, final Skin skin, String styleName, final Stage stage, final MenuScreen menuScreen) {
        super(title, skin, styleName);
        getTitleLabel().setAlignment(Align.center);
        setModal(true);

        info = new Label("Please enter your name", skin, "advira");
        info.setWrap(false);

        textField = new TextField("Your Name", skin);
        textField.setMaxLength(15);
        textField.setOnlyFontChars(true);
        textField.setAlignment(Align.center);
        stage.setKeyboardFocus(textField);
        textField.getOnscreenKeyboard().show(true);
        textField.setSelection(0, textField.getMaxLength());

        btnOk = new ImageTextButton("Enter", skin, "ok");
        btnOk.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(HM.game.player.writeName(textField.getText())){
                    menuScreen.updateNewName();
                    remove();
                }else {
                    WindowErrorName windowError = new WindowErrorName("Enter Name!", skin, false, stage.getWidth()*0.5f);
                    windowError.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
                    stage.addActor(windowError);
                }
            }
        });
        pad(64,30,30,30);
        add(info).prefWidth(stage.getWidth()*0.5f).pad(10).row();
        add(textField).prefWidth(stage.getWidth()*0.5f).pad(10).row();
        add(btnOk);
        pack();

    }

}

package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.CheckBox;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Slider;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.WindowRename;

/**
 * Created by AndyGo on 13.10.2017.
 */

public class SettingsMenu extends ScreenMenuModel{
    private Table table;
    private Label title;
    private CheckBox checkMusic, checkSound, checkWelcome;
    private Slider sliderMusic, sliderSound;
    private TextButton btnChangeName, btnBack;
    private float time;

    public SettingsMenu(){
        super();

        title = new Label(HM.game.bundle.get("settings"), skin, "title");
        title.setAlignment(Align.center);

        checkMusic = new CheckBox(HM.game.bundle.get("music"), skin);
        checkMusic.setChecked(HM.game.settings.isMusic);
        checkMusic.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                HM.game.settings.isMusic = checkMusic.isChecked();
                if(checkMusic.isChecked()){
                    HM.game.music.play();
                }else{
                    HM.game.music.pause();
                }
            }
        });
        sliderMusic = new Slider(0.0f, 1.0f, 0.01f, false, skin);
        sliderMusic.setValue(HM.game.settings.music);
        sliderMusic.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                HM.game.settings.music = sliderMusic.getValue();
                HM.game.music.play();
            }
        });

        checkSound = new CheckBox(HM.game.bundle.get("sound"), skin);
        checkSound.setChecked(HM.game.settings.isSound);
        checkSound.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                HM.game.settings.isSound = checkSound.isChecked();
            }
        });
        sliderSound = new Slider(0.0f, 1.0f, 0.01f, false, skin);
        sliderSound.setValue(HM.game.settings.sound);
        sliderSound.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                HM.game.settings.sound = sliderSound.getValue();
            }
        });

        checkWelcome = new CheckBox(HM.game.bundle.get("welcomeScreen"), skin);
        checkWelcome.setChecked(HM.game.settings.welcome);
        checkWelcome.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                HM.game.settings.welcome = checkWelcome.isChecked();
            }
        });

        btnChangeName = new TextButton(HM.game.bundle.get("rename"), skin);
        btnChangeName.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                WindowRename windowNewName = new WindowRename(HM.game.bundle.get("rename"), skin, "octagon", stage);
                windowNewName.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
                stage.addActor(windowNewName);
            }
        });

        btnBack = new TextButton(HM.game.bundle.get("back"), skin);
        btnBack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end();
            }
        });

        table = new Table(skin);
        table.setBackground("background");
        table.setSize(stage.getWidth()*0.7f, stage.getWidth()*1.19f);
        table.setPosition(-table.getWidth(), posY(table, 0.5f));

        table.add(title).expand().fillX().colspan(2); table.row();
        table.add(checkMusic).expand().fillX(); table.add(sliderMusic).expand().fillX(); table.row();
        table.add(checkSound).expand().fillX(); table.add(sliderSound).expand().fillX(); table.row();
        table.add(checkWelcome).expand().fillX().colspan(2); table.row();
        table.add(btnChangeName).expand().colspan(2); table.row();
        table.add(btnBack).expand().colspan(2); table.row();

        stage.addActor(table);

    }
    public void end(){
        HM.game.settings.writeSettings();
        Gdx.input.setInputProcessor(null);
        time = 0.5f;
        table.addAction(Actions.moveTo(-table.getWidth(), posY(table, 0.5f), time, Interpolation.circleIn));
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_FROM_RIGHT));
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
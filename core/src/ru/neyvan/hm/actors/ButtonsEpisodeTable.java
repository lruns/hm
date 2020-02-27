package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.Player;
import ru.neyvan.hm.screens.EpisodesScreen;

/**
 * Created by AndyGo on 19.11.2017.
 */
public class ButtonsEpisodeTable extends com.badlogic.gdx.scenes.scene2d.ui.Table {
    private Label epizod;
    private Label levels;
    private Label difficult;
    private Label closed;
    private TextButton btnBack;
    private TextButton btnStart;
    private EpisodesScreen parent;

    public ButtonsEpisodeTable(Skin skin, EpisodesScreen parent) {
        super(skin);
        this.parent = parent;
        epizod = new Label("", skin, "advira");
        levels = new Label("", skin, "advira");
        difficult = new Label("", skin, "advira");
        closed = new Label("", skin, "advira");
        btnBack = new TextButton(HM.game.bundle.get("back"), skin);
        btnStart = new TextButton(HM.game.bundle.get("start"), skin);

        add(epizod);
        add(levels).row();
        add(difficult).colspan(2).row();
        add(btnBack).fillX().expandX();
        add(btnStart).fillX().expandX();

        setBackListener();
        setStartListener();
    }

    public void updateInfo() {
        epizod.setText(HM.game.bundle.format("episode", parent.getClickedEpisode().getEpisode()));
        levels.setText(HM.game.bundle.format("numLevels", parent.getClickedEpisode().getLevelsSize()));
        difficult.setText(HM.game.bundle.format("diffucult", parent.getClickedEpisode().printDiffcult()));
        btnStart.setDisabled(!HM.game.player.isOpened(parent.getClickedEpisode()));
    }

    public void setBackListener() {
        btnBack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                parent.backToMenu();
            }
        });
    }

    public void setStartListener() {
        btnStart.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                parent.startEpisode();
            }
        });
    }

}

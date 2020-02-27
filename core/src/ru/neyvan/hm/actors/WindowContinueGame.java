package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.ImageTextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Window;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.game.GameDataLoader;
import ru.neyvan.hm.screens.EpisodesScreen;
import ru.neyvan.hm.screens.MenuScreen;
import ru.neyvan.hm.screens.PlayScreen;

public class WindowContinueGame extends Window {

    WindowContinueGame parent;
    Label info;
    ImageTextButton btnContinue;
    ImageTextButton btnCancel;
    ImageTextButton btnNewGame;

    public WindowContinueGame(String title, final Skin skin, String styleName, final Stage stage, final MenuScreen menuScreen) {
        super(title, skin, styleName);
        getTitleLabel().setAlignment(Align.center);
        setModal(true);

        this.parent = this;
        info = new Label(HM.game.bundle.get("continueGameTitle"), skin, "advira");
        info.setWrap(true);
        info.setAlignment(Align.center);

        btnContinue = new ImageTextButton(HM.game.bundle.get("continue"), skin, "ok");
        btnContinue.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                menuScreen.end(MenuScreen.DISAPPEARANCE_TO_BOTTOM, new PlayScreen());
                remove();
            }
        });
        btnCancel = new ImageTextButton(HM.game.bundle.get("cancel"), skin, "cancel");
        btnCancel.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                remove();
            }
        });

        btnNewGame = new ImageTextButton(HM.game.bundle.get("newGame"), skin);
        btnNewGame.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                final Window windowAsk = new Window(HM.game.bundle.get("newGame"), skin, "octagon");
                windowAsk.getTitleLabel().setAlignment(Align.center);
                windowAsk.setModal(true);

                Label info2 = new Label(HM.game.bundle.get("newGameDanger"), skin, "advira");
                info2.setWrap(true);
                info2.setAlignment(Align.center);

                Button btnOk2 = new ImageTextButton(HM.game.bundle.get("yes"), skin, "ok");
                btnOk2.addListener(new ChangeListener() {
                    @Override
                    public void changed(ChangeEvent event, Actor actor) {
                        menuScreen.end(MenuScreen.DISAPPEARANCE_TO_BOTTOM, new EpisodesScreen());
                        HM.game.player.deleteGame();
                        parent.remove();
                        windowAsk.remove();
                    }
                });
                Button btnCancel2 = new ImageTextButton(HM.game.bundle.get("no"), skin, "cancel");
                btnCancel2.addListener(new ChangeListener() {
                    @Override
                    public void changed(ChangeEvent event, Actor actor) {
                        windowAsk.remove();
                    }
                });
                windowAsk.pad(64,30,30,30);
                windowAsk.add(info2).fillX().prefWidth(stage.getWidth()*0.7f).pad(10).colspan(2).row();
                windowAsk.add(btnOk2).fill();
                windowAsk.add(btnCancel2).fill();
                windowAsk.pack();
                windowAsk.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
                stage.addActor(windowAsk);
            }
        });
        pad(64,30,30,30);
        add(info).pad(10).fillX().center().colspan(2).row();
        add(btnContinue).colspan(2).fillX().row();
        add(btnCancel).fill();
        add(btnNewGame).fill();
        pack();
    }

}
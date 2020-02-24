package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.WindowContinueGame;
import ru.neyvan.hm.actors.WindowExit;
import ru.neyvan.hm.actors.WindowNewName;
import ru.neyvan.hm.game.GameDataLoader;

/**
 * Created by AndyGo on 08.07.2017.
 */

public class MenuScreen extends ScreenMenuModel {

    public static final int APPEARANCE_ELASTIC = 111;
    public static final int APPEARANCE_FROM_TOP = 112;
    public static final int APPEARANCE_FROM_LEFT = 113;
    public static final int APPEARANCE_FROM_RIGHT = 114;
    public static final int APPEARANCE_FROM_BOTTOM = 115;
    public static final int DISAPPEARANCE_TO_TOP = 212;
    public static final int DISAPPEARANCE_TO_LEFT = 213;
    public static final int DISAPPEARANCE_TO_RIGHT = 214;
    public static final int DISAPPEARANCE_TO_BOTTOM = 215;

    private int variantOfAppearance;
    private float time;

    private Group group;
    private Table tableText;
    private Image title;
    private Label label1, label2;
    private Button btnPlay;
    private Button btnSettings;
    private Button btnInfo;
    private Button btnRecord;

    public MenuScreen(int variantOfAppearance){
        super();

        this.variantOfAppearance = variantOfAppearance;

        group = new Group();
        group.setSize(stage.getWidth(), stage.getWidth()*1.67f);
        stage.addActor(group);

        tableText = new Table();
        group.addActor(tableText);

        title = new Image(HM.game.texture.atlas.findRegion("title"));

        label1 = new Label("", skin, "advira");
        label2 = new Label("", skin, "advira");

        if(HM.game.player.isPlayerExist()){
            label1.setText("Welcome "+HM.game.player.getName()+"!");
            label2.setText("Good luck!");
        }else{
            label1.setText("Welcome new user!");
            label2.setText("Glad to see you!");
        }
        label1.pack();
        tableText.add(title).size(group.getWidth(), group.getHeight()*0.25f).row();
        tableText.add(label1).align(Align.center).row();
        tableText.add(label2).align(Align.center).padLeft(label1.getWidth()).row();

        TextureRegionDrawable playTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playNormal"));
        TextureRegionDrawable playTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playClick"));
        btnPlay = new Button(playTexture, playTexture2);
        btnPlay.setSize(group.getWidth()*0.4f, group.getWidth()*0.4f);

        btnPlay.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(HM.game.player.isGameExist()){
                    showWindowContinueGame();
                }else{
                    end(DISAPPEARANCE_TO_BOTTOM, new EpisodesScreen());
                }
            }
        });
        group.addActor(btnPlay);

        TextureRegionDrawable settTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        TextureRegionDrawable settTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        btnSettings = new Button(settTexture, settTexture2);
        btnSettings.setSize(group.getWidth()*0.2f, group.getWidth()*0.2f);
        btnSettings.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_RIGHT, new SettingsMenu());
            }
        });
        group.addActor(btnSettings);

        TextureRegionDrawable infoTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        TextureRegionDrawable infoTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        btnInfo = new Button(infoTexture, infoTexture2);
        btnInfo.setSize(group.getWidth()*0.2f, group.getWidth()*0.2f);
        btnInfo.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_TOP, new InfoMenu());
            }
        });
        group.addActor(btnInfo);

        TextureRegionDrawable recordTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        TextureRegionDrawable recordTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        btnRecord = new Button(recordTexture, recordTexture2);
        btnRecord.setSize(group.getWidth()*0.2f, group.getWidth()*0.2f);
        btnRecord.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_LEFT, new RecordsMenu(false));
            }
        });
        group.addActor(btnRecord);
        setFirstPosition();

    }
    public void show(){
        super.show();
        showActors();
        showWindowNewName();
    }

    public void setFirstPosition(){
        switch (variantOfAppearance){
            case APPEARANCE_ELASTIC:
                group.setPosition(stage.getWidth()*0.5f, stage.getHeight()*0.5f, Align.center);
                tableText.setPosition(posX(group, tableText, 0.5f), posY(group, tableText, 1.25f));
                btnPlay.setPosition(posX(group, btnPlay, 0.5f), posY(group, btnPlay, -1.2f));
                btnSettings.setPosition(posX(group, btnSettings, -0.2f), posY(group, btnSettings, -1.2f));
                btnInfo.setPosition(posX(group, btnInfo, 0.5f), posY(group, btnInfo, -1.8f));
                btnRecord.setPosition(posX(group, btnRecord, 1.2f), posY(group, btnRecord, -1.2f));
                return;
            case APPEARANCE_FROM_TOP:
                group.setPosition(0, group.getHeight());
                break;
            case APPEARANCE_FROM_LEFT:
                group.setPosition(-group.getWidth(), 0);
                break;
            case APPEARANCE_FROM_RIGHT:
                group.setPosition(group.getWidth(), 0);
                break;
            case APPEARANCE_FROM_BOTTOM:
                group.setPosition(0, -group.getHeight());
        }
        tableText.setPosition(posX(group, tableText, 0.5f), posY(group, tableText, 0.75f));
        btnPlay.setPosition(posX(group, btnPlay, 0.5f), posY(group, btnPlay, 0.47f));
        btnSettings.setPosition(posX(group, btnSettings, 0.2f), posY(group, btnSettings, 0.37f));
        btnInfo.setPosition(posX(group, btnInfo, 0.5f), posY(group, btnInfo, 0.25f));
        btnRecord.setPosition(posX(group, btnRecord, 0.8f), posY(group, btnRecord, 0.37f));

    }
    public void showActors(){
        switch (variantOfAppearance){
            case APPEARANCE_ELASTIC:
                time = 2.0f;
                tableText.addAction(Actions.moveTo(posX(group, tableText, 0.5f), posY(group, tableText, 0.75f), time, Interpolation.elastic));
                btnPlay.addAction(Actions.moveTo(posX(group, btnPlay, 0.5f), posY(group, btnPlay, 0.47f), time, Interpolation.elastic));
                btnSettings.addAction(Actions.moveTo(posX(group, btnSettings, 0.2f), posY(group, btnSettings, 0.37f), time, Interpolation.elastic));
                btnInfo.addAction(Actions.moveTo(posX(group, btnInfo, 0.5f), posY(group, btnInfo, 0.25f), time, Interpolation.elastic));
                btnRecord.addAction(Actions.moveTo(posX(group, btnRecord, 0.8f), posY(group, btnRecord, 0.37f), time, Interpolation.elastic));
                break;
            case APPEARANCE_FROM_TOP:
            case APPEARANCE_FROM_RIGHT:
            case APPEARANCE_FROM_LEFT:
            case APPEARANCE_FROM_BOTTOM:
                time = 0.5f;
                group.addAction(Actions.moveTo(posX(group, 0.5f), posY(group,  0.5f), time, Interpolation.pow3Out));
                break;
        }
    }
    private void showWindowNewName() {
        if(HM.game.player.isPlayerExist()) return;
        WindowNewName windowNewName = new WindowNewName("New user", skin, "octagon", stage, this);
        windowNewName.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowNewName);

    }

    private void showWindowContinueGame() {
        WindowContinueGame windowContinueGame = new WindowContinueGame("Continue game", skin, "octagon", stage, this);
        windowContinueGame.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowContinueGame);

    }

    public void end(final int variantOfDisappearance, final Screen screen){
        Gdx.input.setInputProcessor(null);
        time = 0.5f;
        switch (variantOfDisappearance){
            case DISAPPEARANCE_TO_TOP:
                group.addAction(Actions.moveTo(0, stage.getHeight(), time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_LEFT:
                group.addAction(Actions.moveTo(-stage.getWidth(), 0, time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_RIGHT:
                group.addAction(Actions.moveTo(stage.getWidth(), 0, time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_BOTTOM:
                time = 1.0f;
                group.addAction(Actions.moveTo(0, -stage.getHeight(), time, Interpolation.circleIn));
                stage.addAction(Actions.fadeOut(time));
                HM.game.menuFieldPainter.fadeOut(time);
                break;

        }
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        HM.game.setScreen(screen);
                        if(variantOfDisappearance == DISAPPEARANCE_TO_BOTTOM) HM.game.menuFieldPainter.dispose();
                    }
                })
        ));
    }

    @Override
    public void back() {
        super.back();
        Gdx.app.debug("Quit Game", "call window of exit");
        WindowExit windowExit = new WindowExit("Quit Game", skin, "octagon", stage);
        windowExit.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowExit);
    }

    public void updateNewName() {
        label1.setText("Welcome "+HM.game.player.getName()+"!");
    }
}

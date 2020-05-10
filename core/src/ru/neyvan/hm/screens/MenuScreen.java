package ru.neyvan.hm.screens;

        import com.badlogic.gdx.Gdx;
        import com.badlogic.gdx.Preferences;
        import com.badlogic.gdx.Screen;
        import com.badlogic.gdx.math.Interpolation;
        import com.badlogic.gdx.math.Path;
        import com.badlogic.gdx.math.Vector2;
        import com.badlogic.gdx.math.collision.Ray;
        import com.badlogic.gdx.scenes.scene2d.Actor;
        import com.badlogic.gdx.scenes.scene2d.Group;
        import com.badlogic.gdx.scenes.scene2d.actions.Actions;
        import com.badlogic.gdx.scenes.scene2d.actions.MoveToAction;
        import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
        import com.badlogic.gdx.scenes.scene2d.ui.Button;
        import com.badlogic.gdx.scenes.scene2d.ui.Image;
        import com.badlogic.gdx.scenes.scene2d.ui.Label;
        import com.badlogic.gdx.scenes.scene2d.ui.Table;
        import com.badlogic.gdx.scenes.scene2d.ui.Value;
        import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
        import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
        import com.badlogic.gdx.utils.Align;
        import com.badlogic.gdx.utils.Array;
        import com.badlogic.gdx.utils.Pool;
        import com.badlogic.gdx.utils.Pools;
        import com.badlogic.gdx.utils.Timer;

        import ru.neyvan.hm.Constants;
        import ru.neyvan.hm.HM;
        import ru.neyvan.hm.PathAction;
        import ru.neyvan.hm.actors.WindowContinueGame;
        import ru.neyvan.hm.actors.WindowExit;
        import ru.neyvan.hm.actors.WindowNewName;

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

    private Table table;
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

        table = new Table();

        tableText = new Table();
        title = new Image(HM.game.texture.atlas.findRegion("title"));
        label1 = new Label("", skin, "advira");
        label2 = new Label("", skin, "advira");
        label1.setText(HM.game.bundle.get("welcomeEveryone"));
        label2.setText(HM.game.bundle.get("gladToSee"));
//        if(HM.game.player.isPlayerExist()){
//            label1.setText(HM.game.bundle.format("welcome", HM.game.player.getName()));
//            label2.setText(HM.game.bundle.get("goodLuck"));
//        }else{
//            label1.setText(HM.game.bundle.get("welcomeNewUser"));
//            label2.setText(HM.game.bundle.get("gladToSee"));
//        }
        label1.pack();
        tableText.add(title).size(Value.percentWidth(1, table), Value.percentWidth(0.417f, table)).row();
        tableText.add(label1).align(Align.center).row();
        tableText.add(label2).align(Align.center).padLeft(label1.getWidth()).row();

        TextureRegionDrawable playTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playNormal"));
        TextureRegionDrawable playTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playClick"));
        btnPlay = new Button(playTexture, playTexture2);
        btnPlay.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                if(HM.game.player.isGameExist()){
                    if(Constants.gwt){
                        Preferences saves = Gdx.app.getPreferences(Constants.GAME_DATA_PATH);
                        if(!saves.contains("save")){
                            Gdx.app.log("Menu screen","Game not found");
                            end(DISAPPEARANCE_TO_BOTTOM, new EpisodesScreen());
                        }else{
                            Gdx.app.log("Menu screen","Game opening");
                            showWindowContinueGame();
                        }
                    }else{
                        showWindowContinueGame();
                    }

                }else{
                    end(DISAPPEARANCE_TO_BOTTOM, new EpisodesScreen());
                }
            }
        });


        TextureRegionDrawable settTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        TextureRegionDrawable settTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        btnSettings = new Button(settTexture, settTexture2);
        btnSettings.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_RIGHT, new SettingsMenu());
            }
        });



        TextureRegionDrawable infoTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        TextureRegionDrawable infoTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        btnInfo = new Button(infoTexture, infoTexture2);
        btnInfo.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_TOP, new InfoMenu());
            }
        });


        TextureRegionDrawable recordTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        TextureRegionDrawable recordTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        btnRecord = new Button(recordTexture, recordTexture2);
        btnRecord.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                end(DISAPPEARANCE_TO_LEFT, new RecordsMenu(false));
            }
        });


        table.add(tableText).colspan(3);
        table.row();
        table.add(btnSettings).size(Value.percentWidth(0.2f, table));
        table.add(btnPlay).size(Value.percentWidth(0.4f, table));
        table.add(btnRecord).size(Value.percentWidth(0.2f, table));
        table.row();
        table.add(btnInfo).size(Value.percentWidth(0.2f, table)).colspan(3);
        table.setFillParent(true);
        table.setDebug(false);

        stage.addActor(table);
    }
    public void show(){
        super.show();

        setFirstPosition();
        showActors();
        showWindowNewName();
    }

    public void setFirstPosition(){
        switch (variantOfAppearance){
            case APPEARANCE_FROM_TOP:
                table.setPosition(0, stage.getHeight());
                break;
            case APPEARANCE_FROM_LEFT:
                table.setPosition(-stage.getWidth(), 0);
                break;
            case APPEARANCE_FROM_RIGHT:
                table.setPosition(stage.getWidth(), 0);
                break;
            case APPEARANCE_FROM_BOTTOM:
                table.setPosition(0, -stage.getHeight());
        }
    }

    public void showActors(){
        table.validate();
        switch (variantOfAppearance){
            case APPEARANCE_ELASTIC:
                time = 2.0f;

                tableText.addAction(move(
                        0, 1.25f * stage.getHeight(),
                        time, true, Interpolation.elastic
                ));
                btnPlay.addAction(move(
                        0, -1.2f * stage.getHeight(),
                        time, true, Interpolation.elastic
                ));
                btnSettings.addAction(move(
                        -0.2f * stage.getWidth(), -1.2f * stage.getHeight(),
                        time, true, Interpolation.elastic
                ));
                btnInfo.addAction(move(
                        0,-1.8f * stage.getHeight(),
                        time, true, Interpolation.elastic
                ));
                btnRecord.addAction(move(
                        1.2f * stage.getWidth(),-1.2f * stage.getHeight(),
                        time, true, Interpolation.elastic
                ));

                table.addAction(new SequenceAction(
                        Actions.layout(false),
                        Actions.delay(time),
                        Actions.layout(true)
                ));

//                tableText.setPosition(posX(group, tableText, 0.5f), posY(group, tableText, 1.25f));
//                btnPlay.setPosition(posX(group, btnPlay, 0.5f), posY(group, btnPlay, -1.2f));
//                btnSettings.setPosition(posX(group, btnSettings, -0.2f), posY(group, btnSettings, -1.2f));
//                btnInfo.setPosition(posX(group, btnInfo, 0.5f), posY(group, btnInfo, -1.8f));
//                btnRecord.setPosition(posX(group, btnRecord, 1.2f), posY(group, btnRecord, -1.2f));

                break;

            case APPEARANCE_FROM_TOP:
            case APPEARANCE_FROM_RIGHT:
            case APPEARANCE_FROM_LEFT:
            case APPEARANCE_FROM_BOTTOM:
                time = 0.5f;
                table.addAction(Actions.moveTo(0,0, time, Interpolation.pow3Out));
                break;
        }
    }

    private void showWindowNewName() {
//        if(HM.game.player.isPlayerExist()) return;
//        WindowNewName windowNewName = new WindowNewName(HM.game.bundle.get("newUser"), skin, "octagon", stage, this);
//        windowNewName.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
//        stage.addActor(windowNewName);
    }

    private void showWindowContinueGame() {
        WindowContinueGame windowContinueGame = new WindowContinueGame(HM.game.bundle.get("continueGame"), skin, "octagon", stage, this);
        windowContinueGame.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowContinueGame);

    }

    public void end(final int variantOfDisappearance, final Screen screen){
        Gdx.input.setInputProcessor(null);
        time = 0.5f;

        switch (variantOfDisappearance){
            case DISAPPEARANCE_TO_TOP:
                table.addAction(Actions.moveTo(0, stage.getHeight(), time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_LEFT:
                table.addAction(Actions.moveTo(-stage.getWidth(), 0, time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_RIGHT:
                table.addAction(Actions.moveTo(stage.getWidth(), 0, time, Interpolation.circleIn));
                break;
            case DISAPPEARANCE_TO_BOTTOM:
                time = 1.0f;
                table.addAction(Actions.moveTo(0, -stage.getHeight(), time, Interpolation.circleIn));
                stage.addAction(Actions.fadeOut(time));
                HM.game.menuFieldPainter.fadeOut(time);
                break;

        }
        stage.addAction(Actions.sequence(
                Actions.delay(time),
                Actions.run(new Runnable() {
                    @Override
                    public void run() {
                        if(variantOfDisappearance == DISAPPEARANCE_TO_BOTTOM) HM.game.menuFieldPainter.dispose();
                        HM.game.setScreen(screen);
                    }
                })
        ));
    }

    @Override
    public void back() {
        super.back();
        Gdx.app.debug(HM.game.bundle.get("quitGame"), "call window of exit");
        WindowExit windowExit = new WindowExit(HM.game.bundle.get("quitGame"), skin, "octagon", stage);
        windowExit.setPosition(stage.getWidth()/2, stage.getHeight()/2, Align.center);
        stage.addActor(windowExit);
    }

    public void updateNewName() {
        label1.setText(HM.game.bundle.format("welcome", HM.game.player.getName()));
    }

    @Override
    public void resume() {
        super.resume();
        showActors();
    }
}

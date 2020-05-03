package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.scenes.scene2d.ui.TextButton;
import com.badlogic.gdx.scenes.scene2d.ui.Value;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.viewport.ExtendViewport;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;

public class TestScreen implements Screen {

    public Stage stage;
    public Skin skin;

    private Table table;

    private Image title;
    private Button btnMain;
    private Button btnRight;
    private Button btnBottom;
    private Button btnLeft;

    public TestScreen(){
        stage = new StageExtension(new ExtendViewport(Constants.MIN_WIDTH, Constants.MIN_HEIGHT,
                Constants.MAX_WIDTH, Constants.MAX_HEIGHT));
        skin = HM.game.texture.skin;

        title = new Image(HM.game.texture.atlas.findRegion("title"));

        TextureRegionDrawable playTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playNormal"));
        TextureRegionDrawable playTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playClick"));
        btnMain = new Button(playTexture, playTexture2);

        TextureRegionDrawable settTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        TextureRegionDrawable settTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonSettings"));
        btnLeft = new Button(settTexture, settTexture2);

        TextureRegionDrawable infoTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        TextureRegionDrawable infoTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonInfo"));
        btnBottom = new Button(infoTexture, infoTexture2);

        TextureRegionDrawable recordTexture = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        TextureRegionDrawable recordTexture2 = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("buttonRecord"));
        btnRight = new Button(recordTexture, recordTexture2);

        table = new Table();
        table.setFillParent(true);
        table.setDebug(true);

        table.add(title).colspan(3).row();

        table.add(btnLeft);
        table.add(btnMain);
        table.add(btnRight);
        table.row();

        table.add(btnBottom).colspan(3).row();

        stage.addActor(table);
    }

    @Override
    public void show() {

    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        stage.act(delta);
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        stage.getViewport().update(width, height, true);
    }

    @Override
    public void pause() {

    }

    @Override
    public void resume() {
        btnLeft.setTransform(false);
        SequenceAction sequenceAction = new SequenceAction(

                Actions.layout(false),
                Actions.moveBy(25, 25, 5),
                Actions.layout(true)
        );
        btnLeft.addAction(sequenceAction);
    }

    @Override
    public void hide() {

    }

    @Override
    public void dispose() {
        stage.dispose();
    }
}

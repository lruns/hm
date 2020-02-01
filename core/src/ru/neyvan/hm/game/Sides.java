package ru.neyvan.hm.game;

import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.Sprite;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.math.Affine2;
import com.badlogic.gdx.math.Interpolation;
import com.badlogic.gdx.math.Vector2;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.ScreenMenuModel;

/**
 * Created by AndyGo on 25.11.2017.
 */

public class Sides {
    private TextureRegion textureSideLeft, textureSideRihgt;
    private Image leftFrame;
    private Image rightFrame;
    private float time;
    private float width, height;
    public Sides(Stage stage, float time){
        this.width = stage.getWidth();
        this.height = stage.getHeight();
        this.time = time;
        textureSideLeft = HM.game.texture.atlas.findRegion("sideFrame");
        textureSideRihgt = HM.game.texture.atlas.findRegion("sideFrame2");
        leftFrame = new Image(textureSideLeft);
        rightFrame = new Image(textureSideRihgt);

        leftFrame.setSize(0.415f*width, 0.68f*height);
        leftFrame.setPosition(-leftFrame.getWidth(), (height-leftFrame.getHeight())/2);
        rightFrame.setSize(leftFrame.getWidth(), leftFrame.getHeight());
        rightFrame.setPosition(width, (height-rightFrame.getHeight())/2);

        stage.addActor(leftFrame);
        stage.addActor(rightFrame);
    }

    public void start() {
        leftFrame.addAction(Actions.moveTo(0.0625f*width, (height-leftFrame.getHeight())/2, time, Interpolation.circle));
        rightFrame.addAction(Actions.moveTo(0.53f*width, (height-rightFrame.getHeight())/2, time, Interpolation.circle));
    }

    public void back() {
        leftFrame.addAction(Actions.moveTo(-leftFrame.getWidth(), (height-leftFrame.getHeight())/2, time, Interpolation.circle));
        rightFrame.addAction(Actions.moveTo(width, (height-rightFrame.getHeight())/2, time, Interpolation.circle));
    }
}

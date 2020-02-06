package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.ui.Button;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Stack;
import com.badlogic.gdx.scenes.scene2d.utils.ChangeListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.actors.CircleShaderActor;
import ru.neyvan.hm.actors.TextNum;
import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.ChangeSpeedTime;
import ru.neyvan.hm.surprises.Explosion;
import ru.neyvan.hm.surprises.FullFreezing;
import ru.neyvan.hm.surprises.GiftAndTrap;
import ru.neyvan.hm.surprises.HelpSurprise;
import ru.neyvan.hm.surprises.Rotation;
import ru.neyvan.hm.surprises.ScreenEffects;
import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.surprises.Transference;
import ru.neyvan.hm.surprises.WarpSurprise;

import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE0;
import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE1;

/**
 * This class for graphical changes of game, not for game logic!
 * You can change number with function {@link GameCircle#displayNextOnCircle}
 *
 * Created by AndyGo on 01.01.2018.
 */

public class GameCircle {
    private float time;
    private Stack stack;
    private Image imgCircleLower, imgCircleUpper;
    private ImageButton imgPlay;
    private Image imgMinCircle;
    //private TextNum numberText;
    private CircleShaderActor circleBar;
    private PlayScreen parent;
    private final float MAX_BAR = 0.9999f;
    private final float MIN_BAR = 0.0001f;
    private float barFullness; //0.0 - 1.0
    private float speedChangeBar;
    private float timeExplosion;
    private int remainingExplosions;

    // for testing
    private Label testText;

    public GameCircle(final PlayScreen parent, float time){
        this.parent = parent;
        this.time = time;

        stack = new Stack();
        stack.setSize(0.45f*parent.getStage().getWidth(), 0.45f*parent.getStage().getWidth());
        stack.setPosition(0.5f*parent.getStage().getWidth(), 0.5f*parent.getStage().getHeight(), Align.center);

        imgCircleLower = new Image(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("circleLower")));
        imgCircleLower.setSize(stack.getWidth(), stack.getHeight());
        stack.addActor(imgCircleLower);

        imgCircleUpper = new Image(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("circleUpper")));
        imgCircleUpper.setSize(stack.getWidth(), stack.getHeight());
        stack.addActor(imgCircleUpper);

        //numberText = new TextNum(String.valueOf(1), Color.WHITE, stack.getWidth(), stack.getHeight());
        //stack.addActor(numberText);

        testText = new Label("0", parent.getSkin());
        testText.setFontScale(5);
        testText.setAlignment(Align.center);
        stack.addActor(testText);

        circleBar = new CircleShaderActor(Color.BLUE);
        circleBar.setSize(stack.getWidth(), stack.getHeight());
        stack.addActor(circleBar);

        imgPlay = new ImageButton(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playClick")),
                new TextureRegionDrawable(HM.game.texture.atlas.findRegion("playNormal")));
        imgPlay.setSize(stack.getWidth(), stack.getHeight());
        imgPlay.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {
                parent.changePause();
            }
        });
        imgPlay.setVisible(false);
        stack.addActor(imgPlay);

        stack.addListener(new ChangeListener() {
            @Override
            public void changed(ChangeEvent event, Actor actor) {

                //PROBLEM!!!
                //parent.circleClicked();
            }
        });

        parent.getStage().addActor(stack);

        imgMinCircle = new Image(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("minCircle")));
        imgMinCircle.setSize(stack.getWidth()*0.15f, stack.getHeight()*0.15f);
        imgMinCircle.setPosition(stack.getX()+stack.getWidth()/2 - imgMinCircle.getWidth()/2, stack.getY()-imgMinCircle.getHeight()*0.25f);
        parent.getStage().addActor(imgMinCircle);

        barFullness = 0.001f;
        speedChangeBar = 0;

    }

    public void update(float delta){
        updateBar(delta);
    }

    /**
     * Prepare next number for showing on circle
     * @param number
     */
    public void displayNextOnCircle(int number){
        //numberText.setText(String.valueOf(number));
        testText.setText(String.valueOf(number));
    }
    /**
     * Prepare next number for showing on circle
     * @param surprise
     */
    public void displayNextOnCircle(Surprise surprise){
        //numberText.setSurprise(surprise);
        testText.setText("Surprise!");
    }

    // These three functions responsible for work bar around circle
    // First disappear bar instantly
    // Another two functions point where to aim.
    public void resetBar(){
        //with some effect
        barFullness = MIN_BAR;
        speedChangeBar = 0;
    }
    public void resetBar(float time){
        speedChangeBar = -(barFullness - MIN_BAR) / time;
    }
    public void fillBar(float time){
        speedChangeBar = (MAX_BAR - barFullness) / time;
    }

    private void updateBar(float delta){
//        circleBar.reloadCenterPosition();
        barFullness += delta * speedChangeBar;
        if(barFullness > MAX_BAR) {
            barFullness = MAX_BAR;
            speedChangeBar = 0;
        }else if (barFullness < MIN_BAR) {
            barFullness = MIN_BAR;
            speedChangeBar = 0;
        }
        circleBar.setOpen(barFullness);
    }




    public void start() {
        stack.addAction(Actions.alpha(0));
        stack.addAction(Actions.fadeIn(time));
    }

    public void back() {
        stack.addAction(Actions.fadeOut(time));
    }

    public void updateChangeSymbol(float delta){
        //numberText.update(delta);
    }

    public void startSurpriseExplosion(){
        timeExplosion = parent.getExplosion().getMaxTimeExplosion();
        remainingExplosions = parent.getExplosion().getMaxNumberExplosions();
    }


    public void setVisiblePlay(boolean pause) {
        imgPlay.setVisible(pause);
        //numberText.setVisible(!pause);
        circleBar.setVisible(!pause);
        imgMinCircle.setVisible(!pause);
    }

    public void setColor(Color color) {
        circleBar.setColor(color);
    }




    public void updateExplosion(float delta){
        timeExplosion -= delta;
        if(timeExplosion<0){
            finishOneOfExplosion();
        }
        if(parent.getExplosion().getTime() < 0.01f && timeExplosion > 0 && timeExplosion > 0.0111f){
            finishOneOfExplosion();
        }
        //numberText.update(delta);
    }

    private void finishOneOfExplosion() {
        remainingExplosions--;
        timeExplosion = parent.getExplosion().getMaxTimeExplosion();
    }





    public void dispose(){
       // numberText.dispose();
    }
}

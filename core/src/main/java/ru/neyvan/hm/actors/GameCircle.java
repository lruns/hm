package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.InputEvent;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.RunnableAction;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Stack;
import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.game.Symbol;
import ru.neyvan.hm.screens.PlayScreen;

/**
 * This class for graphical changes of game, not for game logic!
 *
 * Created by AndyGo on 01.01.2018.
 */

public class GameCircle extends Group {

    private Stack stack;
    private Image imgCircleLower, imgCircleUpper;
    private Image imgMinCircle;
    private CircleShaderActor circleBar;
    private PlayScreen core;
    private final float MAX_BAR = 0.9999f;
    private final float MIN_BAR = 0.0001f;
    private float barFullness; //0.0 - 1.0
    private float speedChangeBar;
    private SymbolText symbolText;

    // for testing
//    private Label testText;

    public GameCircle(final PlayScreen core){
        super();
        this.core = core;

        stack = new Stack();
        imgCircleLower = new Image();
        imgCircleUpper = new Image();
        symbolText = new SymbolText(String.valueOf(1), Color.WHITE, stack.getWidth(), stack.getHeight());
//        testText = new Label("0", HM.game.texture.skin);
//        testText.setFontScale(5);
//        testText.setAlignment(Align.center);

        circleBar = new CircleShaderActor(Color.BLUE);

        imgMinCircle = new Image();

        barFullness = 0.001f;
        speedChangeBar = 0;

        stack.addActor(imgCircleLower);
        stack.addActor(imgCircleUpper);
//        stack.addActor(testText);
        stack.addActor(symbolText);
        stack.addActor(circleBar);
        addActor(stack);
        addActor(imgMinCircle);

        addListener(new ClickListener(){
            @Override
            public void clicked(InputEvent event, float x, float y) {
                Gdx.app.debug("GameCircle", "click!");
                core.clickOnDisplay();
            }
        });
    }

    public void setImages(int i_appearance){
        imgCircleLower.setDrawable(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("circleLower"+i_appearance)));
        imgCircleUpper.setDrawable(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("circleUpper"+i_appearance)));
        imgMinCircle.setDrawable(new TextureRegionDrawable(HM.game.texture.atlas.findRegion("minCircle"+i_appearance)));
    }

    @Override
    public void setSize(float width, float height) {
        super.setSize(width, height);
        stack.setSize(width,height);
        imgMinCircle.setSize(stack.getWidth()*0.15f, stack.getHeight()*0.15f);
        imgMinCircle.setPosition(stack.getX()+stack.getWidth()/2 - imgMinCircle.getWidth()/2, stack.getY()-imgMinCircle.getHeight()*0.25f);
    }

    @Override
    public void act(float delta){
        super.act(delta);
        updateBar(delta);
    }

    public void updateBar(float delta){
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


    public void display(Symbol symbol){
        symbolText.setSymbol(symbol);
    }
    public void display(Symbol symbol, float duration){
        symbolText.setSymbol(symbol, duration);
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


    public void showSymbol(){
        //numberText.setVisible(true);
        circleBar.setVisible(true);
        imgMinCircle.setVisible(true);
    }

    public void hideSymbol() {
        //numberText.setVisible(false);
        circleBar.setVisible(false);
        imgMinCircle.setVisible(false);
    }

    public void dispose(){
        symbolText.dispose();
    }

    public void glowBar(float duration, Color color) {
        circleBar.setColor(color);
        RunnableAction run = new RunnableAction();
        run.setRunnable(new Runnable() {
            @Override
            public void run() {
                circleBar.setColor();
            }
        });
        addAction(Actions.sequence(Actions.delay(duration), run));
    }

    // is very bad realization, but I not have time for something better
    public void updateSizePosition(){

    }

    public void explose(Symbol symbol, float duration) {
        symbolText.setSymbol(symbol, duration);
    }
}

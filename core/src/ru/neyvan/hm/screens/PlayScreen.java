package ru.neyvan.hm.screens;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.InputMultiplexer;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.ScreenAdapter;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.utils.Base64Coder;
import com.badlogic.gdx.utils.Json;
import com.badlogic.gdx.utils.viewport.FitViewport;

import java.io.FileInputStream;
import java.io.ObjectInputStream;

import ru.neyvan.hm.BottomPause;
import ru.neyvan.hm.Constants;
import ru.neyvan.hm.HM;
import ru.neyvan.hm.effects.Shine;
import ru.neyvan.hm.effects.StreamEnergy;
import ru.neyvan.hm.game.GUI;
import ru.neyvan.hm.game.GameCircle;
import ru.neyvan.hm.game.Sides;
import ru.neyvan.hm.levels.Check;
import ru.neyvan.hm.levels.Level;
import ru.neyvan.hm.surprises.ChangeSpeedTime;
import ru.neyvan.hm.surprises.Explosion;
import ru.neyvan.hm.surprises.FullFreezing;
import ru.neyvan.hm.surprises.GiftAndTrap;
import ru.neyvan.hm.surprises.HelpSurprise;
import ru.neyvan.hm.surprises.Surprise;

/**
 * Created by AndyGo on 08.07.2017.
 */

public class PlayScreen extends ScreenAdapter {

    private SpriteBatch batch;
    private OrthographicCamera camera;
    private StreamEnergy streamEnergy;
    private Shine shine;
    private Texture background;
    private Stage stage;
    private Skin skin;
    private GUI gui;
    private Sides sides;
    private GameCircle gameCircle;
    private BottomPause bottomPause;
    private float time;
    private boolean pause;

    private Level level;
    private Json json;
    private FileHandle fileHandle;
    private int currentNumber;
    private int countMove;
    private float accelerationSpeedChangeTS, speedChangeTS, timeStep, timeAfterStep;
    private int countEffects = 0;
    private boolean win = false;
    private boolean clicked = false;
    private Surprise curDisplaySurprise;
    private Explosion explosion;

    private float barFullness; //0.0 - 1.0
    private float speedChangeBar;
    private float timeState;
    private int state;
    private static final int WAITING_CLICK = 1;
    private static final int AFTER_CLICK = 2;
    private static final int NOT_CLICK = 3;
    private static final int CHANGE = 4;
    private static final int FALSE_NOT_CLICK = 5;
    private static final int EXPLOSION = 6;
    private static final int WIN = 7;
    private static final int LOSER = 8;

    private int lifes;
    private int score;

    public PlayScreen(int clickedEpisode) {
        try {
            json = new Json();
            fileHandle = Gdx.files.internal("episodes/level1.lvl");
            level = json.fromJson(Level.class,
                    Base64Coder.decodeString(fileHandle.readString()));

        } catch (Exception e) {
            System.out.println("Exception thrown during open level file: " + e.toString());
        }
        timeStep = level.getTimeStep();
        timeAfterStep = level.getTimeAfterStep();
        speedChangeTS = level.getSpeedChangeTS();
        accelerationSpeedChangeTS = level.getAccelerationSpeedChangeTS();
        currentNumber = level.getFirstNumber();
        countMove = 0;

        time = 1f;
        camera = new OrthographicCamera();
        camera.setToOrtho(false, Constants.WIDTH, Constants.HEIGHT);
        batch = new SpriteBatch();
        streamEnergy = new StreamEnergy();
        shine = new Shine();
        background = HM.game.texture.getMenuBackground(level.getI_background());

        stage = new Stage(new FitViewport(Constants.WIDTH, Constants.HEIGHT));
        skin = HM.game.texture.skin;
        gui = new GUI(this, time);
        sides = new Sides(stage, time);
        gameCircle = new GameCircle(this, time);
        bottomPause = new BottomPause(this);


    }

    public void show() {
        InputProcessor backProcessor = new InputAdapter() {
            @Override
            public boolean keyDown(int keycode) {
                if ((keycode == Input.Keys.ESCAPE) || (keycode == Input.Keys.BACK)) back();
                return false;
            }
        };
        InputMultiplexer multiplexer = new InputMultiplexer(stage, backProcessor);
        Gdx.input.setInputProcessor(multiplexer);
        streamEnergy.create((int) (camera.viewportWidth / 2), 0, 1f, 0.3f, camera.viewportHeight);
        gui.start();
        sides.start();
        gameCircle.start();
    }

    @Override
    public void render(float delta) {
        Gdx.gl.glClearColor(0, 0, 0, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        update(delta);
        batch.setProjectionMatrix(camera.combined);
        batch.begin();
        batch.draw(background, 0, 0);
        streamEnergy.draw(batch);
        shine.draw(batch);
        batch.end();
        stage.draw();
    }

    public void update(float delta) {
        stage.act(delta);
        gui.update(delta);

        if(pause)return;
        timeState -= delta;
        switch (state){
            case WAITING_CLICK:
                barFullness += speedChangeBar * delta;
                gameCircle.updateBar(delta, barFullness);
                if(timeState<0){ // it didn't click
                    state = NOT_CLICK;
                    timeState = timeAfterStep*0.5f;
                    if (currentNumber == -1) { //now is not number, it is surprise
                        if(!goodSurprise()){
                            congratulation(timeState); //player missed a bad surprise
                        }else{
                            disgrace(timeState); //player missed a good surprise
                        }
                    } else if (checkMove()) {
                        congratulation(timeState); //number is not pressed by player and number is false => player did correct solution
                    } else {
                        state = FALSE_NOT_CLICK;
                        timeState = 1.0f;
                        disgrace(timeState); //number is not pressed by player and number is true => player did mistake
                        break;
                    }
                }
                break;
            case AFTER_CLICK:
                //speedChangeBar = (1.0f - barFullness)/timeState;
                barFullness += speedChangeBar * delta;
                gameCircle.updateBar(delta, barFullness);
                if(timeState<0){
                    if(curDisplaySurprise instanceof Explosion){
                        explosion = (Explosion) curDisplaySurprise;
                        state = EXPLOSION;
                        timeState = explosion.getMaxTime();
                        gameCircle.setColor(Color.RED);
                        speedChangeBar = 1.0f / timeState;
                        barFullness = 0;
                        break;
                    }
                    jumpToStateChange();
                }
                break;
            case NOT_CLICK:
                if(timeState<0){
                    state = CHANGE;
                    timeState = timeAfterStep*0.5f;
                }
                break;
            case CHANGE:

                if (timeState<0){
                    if(clicked && currentNumber == -1){

                    }
                    if(win){
                        state = WIN;
                        timeState = 3.0f;
                    }else if(lifes<=0){
                        state = LOSER;
                        timeState = 3.0f;
                    }
                    nextNumberOrSurprise();
                    state = WAITING_CLICK;
                    speedChangeTS += accelerationSpeedChangeTS;
                    timeStep += speedChangeTS;
                    timeAfterStep += speedChangeTS;
                    clicked = false;
                }
                break;
            case FALSE_NOT_CLICK:
                //burn number
                if(timeState<0){
                    jumpToStateChange();
                }
                break;
            case EXPLOSION:
                gameCircle.updateExplosion(delta);
                if(timeState<0){

                }
                break;
            case WIN:
                break;
            case LOSER:
                break;
        }

        streamEnergy.update(delta);

//        if (pause) return;
//        if (win) {
//            return;
//        }
//        if (clicked) {
//            timeJump -= delta * 10;
//            //эффект рассеивания красного или зеленого света при нажатии
//        } else {
//            timeJump -= delta;
//        }
//        if (timeJump < 0) {
//            //change time step (watch Level class)
//            speedChangeTS += accelerationSpeedChangeTS;
//            timeStep += speedChangeTS;
//            timeAfterStep += speedChangeTS;
//            if (!clicked & turn) { //it is end of player's turn and player didn't click
//                if (currentNumber == -1) {
//                    neutrally(); //surprise is not activated by player
//                } else if (checkMove()) {
//                    congratulation(); //number is not pressed by player and number is false => player did correct solution
//                } else {
//                    disgrace(); //number is not pressed by player and number is true => player did mistake
//                }
//                nextNumber();
//                timeJump = timeAfterStep;
//                clicked = false;
//            } else if (!turn) { // it is end of rest between turns
//                timeJump = timeStep;
//                continuation();
//            }
//            turn = !turn;
//        }
//        streamEnergy.update(delta);
//        gameCircle.updateBar(delta, turn ? (timeStep - timeJump) / timeStep : timeJump / timeAfterStep);
    }

    private void jumpToStateChange() {
        state = CHANGE;
        timeState = timeAfterStep*0.5f;
        barFullness = 0;
    }

    private boolean goodSurprise() {
        if(curDisplaySurprise instanceof Explosion || curDisplaySurprise instanceof FullFreezing ||
                curDisplaySurprise instanceof HelpSurprise) return true;
        if(curDisplaySurprise instanceof ChangeSpeedTime){
            ChangeSpeedTime cst = (ChangeSpeedTime)(curDisplaySurprise);
            if(cst.getMultiplierTime() > 1.0f) return true;
        }
        if(curDisplaySurprise instanceof GiftAndTrap){
            GiftAndTrap cat = (GiftAndTrap)(curDisplaySurprise);
            if(cat.getType() == GiftAndTrap.SUPER_LIFE || cat.getType() == GiftAndTrap.SUPER_SCORE) return true;
        }
        return false;
    }


    private void nextNumberOrSurprise() {
        countMove++;
        if (level.getCountOfMoves() == countMove) {
            win = true;
            return;
        }
        if (level.getSurprises().size() != 0 && level.isRandomSurpriseMove()) {
            if (MathUtils.random() > 0.9 || (level.getCountOfMoves() - countMove < 10)) {
                int i = MathUtils.random(0, level.getSurprises().size() - 1);
                curDisplaySurprise = level.getSurprises().get(countEffects);
                gameCircle.displayIconSurprise(curDisplaySurprise);
                level.getSurprises().remove(i);
                return;
            }
        }
        for (int place : level.getListOfPlacesSurp()) {
            if (place == countMove) {
                if (level.isOutOfOrderAppearanceSurprise()) {
                    int i = MathUtils.random(0, level.getSurprises().size() - 1);
                    curDisplaySurprise = level.getSurprises().get(countEffects);
                    gameCircle.displayIconSurprise(curDisplaySurprise);
                    level.getSurprises().remove(i);
                    return;
                }
                curDisplaySurprise = level.getSurprises().get(countEffects);
                gameCircle.displayIconSurprise(curDisplaySurprise);
                countEffects++;
                return;
            }
        }
        if (level.isFixedCounting()) {
            currentNumber = level.getFixedNumbers().get(countMove);
        } else {
            currentNumber += level.getDeltaNumbers();
        }
        gameCircle.changeNumber(currentNumber);
    }


    public void circleClicked() {
        clicked = true;
        state = AFTER_CLICK;
        timeState = timeAfterStep * 0.5f;
        speedChangeBar = (1.0f-barFullness)/(0.3f*timeState);
        if (currentNumber == -1) { //now is not number, it is surprise
            if(goodSurprise()){
                congratulation(timeState); //player activate a good surprise
                if (curDisplaySurprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(curDisplaySurprise);
                    if(cat.getType() == GiftAndTrap.SUPER_LIFE){
                        lifes = lifes + cat.getNumber();
                        gui.setLifes(lifes);
                    }else{
                        score = score + cat.getNumber();
                        gui.setNewScore(score);
                    }
                }
            }else{
                disgrace(timeState); //player activate a bad surprise
                if (curDisplaySurprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(curDisplaySurprise);
                    if(cat.getType() == GiftAndTrap.DEBUF_LIFE){
                        lifes = lifes - Math.abs(cat.getNumber());
                        gui.setLifes(lifes);
                    }else{
                        score = score - Math.abs(cat.getNumber());
                        gui.setNewScore(score);
                    }
                }
            }
        } else if (checkMove()) {
            congratulation(timeState); //number is pressed by player and number is true => player did correct solution
        } else {
            disgrace(timeState); //number is pressed by player and number is false => player did mistake
        }
        Gdx.app.log("circle", "click");
    }

    private boolean checkMove() {
        for (Check check : level.getChecksOfMove()) {
            check.makeOperation(level.getTerms(), level.getChecksOfMove(), currentNumber);
        }
        return clicked == level.getChecksOfMove().get(level.getChecksOfMove().size() - 1).getResult();
    }

    private void congratulation(float duration) {
        gameCircle.setColor(Color.GREEN);
        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, 1, true);
    }

    private void disgrace(float duration) {
        gameCircle.setColor(Color.RED);
        shine.create((int)(camera.viewportWidth / 2), (int)(camera.viewportHeight / 2), 1, 1, 1, true);
    }

    public void back() {
        Gdx.input.setInputProcessor(null);
        HM.game.setScreen(new MenuScreen(MenuScreen.APPEARANCE_ELASTIC));

        gui.back();
        sides.back();
        gameCircle.back();
    }

    public void changePause() {
        if (pause) {
            pause = false;
            gui.changeImagePlayToPause();
            bottomPause.toDisappear();
            gameCircle.setVisiblePlay(pause);
        } else {
            pause = true;
            gui.changeImagePauseToPlay();
            bottomPause.toVisible();
            gameCircle.setVisiblePlay(pause);
        }
    }

    @Override
    public void resize(int width, int height) {
        stage.getViewport().update(width, height, false);
    }

    @Override
    public void dispose() {
        stage.dispose();
        streamEnergy.dispose();
        shine.dispose();
    }

    public Stage getStage() {
        return stage;
    }

    public Skin getSkin() {
        return skin;
    }

    public Level getLevel() {
        return level;
    }

    public Explosion getExplosion() {
        return explosion;
    }
}

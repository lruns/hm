package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.utils.Timer;

import ru.neyvan.hm.screens.PlayScreen;

public class PortalState extends State {

    private float transitionTime;
    private float inPortalTime;
    private float currentTransitionTime;
    private float transitionProgress; // 0.0 - 1.0

    private boolean updateLevel;
    private boolean isTransition = false;
    private boolean isEnteringToPortal = false;
    private boolean inPortal = false;

    public PortalState(final PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        transitionTime = time * 0.3f;
        inPortalTime = time * 0.55f;
        updateLevel = false;

        core.getGui().disappear(transitionTime);
        core.getGui().resetGamePause();

        Timer.schedule(new Timer.Task() {
            @Override
            public void run() {
                jumpToPortal();
            }
        }, time*0.15f);


        Gdx.app.debug("PortalState", "Begin state with time " + time);
    }

    @Override
    public void update(float delta) {
        if(isTransition){
            currentTransitionTime += delta;
            transitionProgress = currentTransitionTime / transitionTime;
        }
         if(!updateLevel && inPortal()){
            core.getGame().nextLevel();
            core.getGui().setLevelDescription(core.getGame().getLevelDescription());
            core.getGui().prepareLevel();
            updateLevel = true;
            Timer.schedule(new Timer.Task() {
                @Override
                public void run() {
                    jumpOutOfPortal();
                }
            }, inPortalTime);
        }
    }

    @Override
    public void end() {
        core.nextState(core.getBeginState(), core.beginStateTime);
    }

    public void jumpToPortal() {
        isTransition = true;
        isEnteringToPortal = true;
        currentTransitionTime = 0;
        Timer.schedule(new Timer.Task() {
            @Override
            public void run() {
                inPortal = true;
                isTransition = false;
            }
        }, transitionTime);
    }

    public void jumpOutOfPortal() {
        core.getGui().appear(transitionTime);
        currentTransitionTime = 0;
        isTransition = true;
        isEnteringToPortal = false;
        inPortal = false;
        Timer.schedule(new Timer.Task() {
            @Override
            public void run() {
                isTransition = false;
                end();
            }
        }, transitionTime);
    }

    public boolean inPortal() {
        return inPortal;
    }

    public boolean isTransition() {
        return isTransition;
    }

    public boolean isEnteringToPortal() {
        return isEnteringToPortal;
    }

    public float getTransitionProgress() {
        return transitionProgress;
    }
}

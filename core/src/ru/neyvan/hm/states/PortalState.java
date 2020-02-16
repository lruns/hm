package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class PortalState extends State {

    private boolean updateLevel;
    public PortalState(final PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        updateLevel = false;
        core.getGui().disappear(time);
        core.getGui().jumpToPortal();
        core.getGame().nextLevel();
        Gdx.app.debug("PortalState", "Begin state with time " + time);
    }

    @Override
    public void update(float delta) {
        super.update(delta);
        if(!updateLevel && core.getGui().inPortal()){
            core.getGui().prepareLevel();
            updateLevel = true;
        }
    }

    @Override
    public void end() {
        if(!updateLevel) core.getGui().prepareLevel();
        core.getGui().jumpOutOfPortal();
        core.nextState(core.getBeginState(), core.beginStateTime);
    }
}

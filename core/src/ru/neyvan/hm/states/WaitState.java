package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.game.Symbol;
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

public class WaitState extends State{

    private boolean clicked = false;

    public WaitState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("WaitState", "Begin state with time " + time);
    }

    public void click(){
        clicked = true;
        end();
    }

    @Override
    public void end() {
        if(clicked) displayClicked();
        else displayNotClicked();
        clicked = false;
    }

    private void displayClicked(){
        Symbol symbol = core.getGame().getSymbol();
        if (symbol.isSurprise()) { //now is not number, it is surprise
            Surprise surprise = symbol.getSurpise();

            // surprises that manipulate the process of the game (change state of the game)
            if(surprise instanceof Explosion){
                core.getExplosionState().setNumberExplosion(((Explosion) surprise).getMaxNumberExplosions());
                core.nextState(core.getExplosionState(), surprise.getMaxTime());
                return;
            }else if(surprise instanceof FullFreezing){
                core.nextState(core.getFullFreezingState(), surprise.getMaxTime());
                return;
            }

            // surprises that influence the game (add impacts) or change (immediately) scores and lifes
            if(symbol.isGoodSurprise()){
                core.getGui().congratulation(core.getGame().getTimeReaction()); //player activate a good surprise
                Gdx.app.debug("Wait.displayClicked", "Clicked good surprise: " + symbol.getSurpise().toString());

                if (surprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(surprise);
                    if(cat.getType() == GiftAndTrap.SUPER_LIFE){
                        core.getGame().increaseLifes(cat.getNumber());
                        core.getGui().updateLife();
                    }else{
                        core.getGame().increaseScore(cat.getNumber());
                        core.getGui().updateScore();
                    }
                }else if(surprise instanceof ChangeSpeedTime){
                    core.addImpact(core.getChangeSpeedTimeImpact(), surprise);
                }else if(surprise instanceof HelpSurprise){
                    core.addImpact(core.getHelpSurpriseImpact(), surprise);
                }

            }else{
                Gdx.app.debug("Wait.displayClicked", "Clicked bad surprise: " + symbol.getSurpise().toString());
                core.getGui().disgrace(1f); //player activate a bad surprise
                if (surprise instanceof GiftAndTrap){
                    GiftAndTrap cat = (GiftAndTrap)(surprise);
                    if(cat.getType() == GiftAndTrap.DEBUF_LIFE){
                        core.getGame().decreaseLifes(cat.getNumber());
                        core.getGui().updateLife();
                    }else{
                        core.getGame().decreaseScore(cat.getNumber());
                        core.getGui().updateScore();
                    }
                }else if(surprise instanceof ChangeSpeedTime){
                    core.addImpact(core.getChangeSpeedTimeImpact(), surprise);
                }else if(surprise instanceof Rotation){
                    core.addImpact(core.getRotationImpact(), surprise);
                }else if(surprise instanceof ScreenEffects) {
                    core.addImpact(core.getScreenEffectsImpact(), surprise);
                }else if(surprise instanceof Transference) {
                    core.addImpact(core.getTransferenceImpact(), surprise);
                }else if(surprise instanceof WarpSurprise) {
                    core.addImpact(core.getWarpSurpriseImpact(), surprise);
                }
            }
        } else if (core.getGame().checkClick()) {
            //number is pressed by player and number is true => player did correct solution
            core.getGui().congratulation(core.getGame().getTimeReaction());
            core.getGame().increaseScore();
            core.getGui().updateScore();
            Gdx.app.debug("Wait.displayClicked", "Clicked good number: " + symbol.getNumber());
        } else {
            //number is pressed by player and number is false => player did mistake
            core.getGui().disgrace(core.getGame().getTimeReaction());
            core.getGame().decreaseLifes(1);
            core.getGui().updateLife();
            Gdx.app.debug("Wait.displayClicked", "Clicked bad number: " + symbol.getNumber());
        }
        core.nextState(core.getReactionState(), getLostTime() + core.getGame().getTimeReaction());
    }

    private void displayNotClicked() {
        Symbol symbol = core.getGame().getSymbol();
        if (symbol.isSurprise()) { //now is not number, it is surprise
            if(!symbol.isGoodSurprise()) {
                core.getGui().congratulation(core.getGame().getTimeReaction());
                Gdx.app.debug("Wait.displayNotClicked", "Missed bad surprise: " + symbol.getSurpise().toString());
            }else {
                core.getGui().disgrace(core.getGame().getTimeReaction()); //player missed a good
                Gdx.app.debug("Wait.displayNotClicked", "Missed good surprise: " + symbol.getSurpise().toString());
            }
        }else{
            if (!core.getGame().checkClick()) {
                //number is not pressed by player and number is false => player did correct solution
                core.getGui().congratulation(core.getGame().getTimeReaction());
                core.getGame().increaseScore();
                core.getGui().updateScore();
                Gdx.app.debug("Wait.displayNotClicked", "Missed bad number: " + symbol.getNumber());
            }else{
                //number is not pressed by player and number is true => player did mistake
                core.getGui().disgrace(core.getGame().getTimeReaction());
                core.getGame().decreaseLifes(1);
                core.getGui().updateLife();
                Gdx.app.debug("Wait.displayNotClicked", "Missed good number: " + symbol.getNumber());
            }
        }
        core.nextState(core.getReactionState(), core.getGame().getTimeReaction());
    }
}
package ru.neyvan.hm.json_creater;

import com.badlogic.gdx.scenes.scene2d.Action;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.actions.DelayAction;
import com.badlogic.gdx.scenes.scene2d.actions.RunnableAction;
import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
import com.badlogic.gdx.scenes.scene2d.ui.Dialog;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import com.badlogic.gdx.utils.Align;

public class DialogLoading extends Dialog {
    private Runnable runnable;
    private ScreenLevelEditor main;
    
    public DialogLoading(String title, Runnable runnable, ScreenLevelEditor main) {
        super(title, main.getSkin(), "dialog");
        this.main = main;
        this.runnable = runnable;
        setFillParent(true);
        populate();
    }

    @Override
    public Dialog show(Stage stage) {
        Dialog dialog = super.show(stage);
        RunnableAction runnableAction = new RunnableAction();
        runnableAction.setRunnable(new Runnable() {
            @Override
            public void run() {
                if (runnable != null) {
                    runnable.run();
                }
                hide();
            }
        });
        Action action = new SequenceAction(new DelayAction(.5f), runnableAction);
        addAction(action);
        
        return dialog;
    }
    
    public void populate() {
        Table t = getContentTable();
        Label label = new Label("Loading...", main.getSkin(), "title");
        label.setAlignment(Align.center);
        t.add(label);
    }
}
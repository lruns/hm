package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;

import java.util.ArrayList;

import ru.neyvan.hm.game.Episodes;
import ru.neyvan.hm.screens.EpisodesScreen;

/**
 * Created by AndyGo on 19.11.2017.
 */
public class EpisodesTable extends Table{
    private EpisodesScreen parent;
    private ArrayList<FieldEpisode> fields;
    public EpisodesTable(Skin skin, EpisodesScreen parent){
        super(skin);
        this.parent = parent;
        fields = new ArrayList<FieldEpisode>();
        for(int i = 0; i < Episodes.MAX_EPISODES; i++){
            fields.add(new FieldEpisode(i, parent));
        }
        for(int i = Episodes.MAX_EPISODES-1; i >= 0; i--){
            add(fields.get(i)).row();
        }

    }

}

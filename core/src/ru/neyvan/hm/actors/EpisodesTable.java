package ru.neyvan.hm.actors;

import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Table;

import java.util.ArrayList;

import ru.neyvan.hm.Constants;
import ru.neyvan.hm.levels.LevelNumber;
import ru.neyvan.hm.screens.EpisodesScreen;

/**
 * Created by AndyGo on 19.11.2017.
 */
public class EpisodesTable extends Table{ ;
    private ArrayList<FieldEpisode> fields;
    public EpisodesTable(Skin skin, EpisodesScreen parent){
        super(skin);
        fields = new ArrayList<FieldEpisode>();
        for(int i = 0; i < Constants.MAX_EPISODE; i++){
            fields.add(new FieldEpisode(new LevelNumber(i+1, 1), parent));
        }
        for(int i = Constants.MAX_EPISODE-1; i >= 0; i--){
            add(fields.get(i)).row();
        }

    }

}
